import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Res, UseInterceptors, UsePipes } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { Response } from 'express';

import AppDomainStateManager from '../../app-domain-state-manager';
import AppHealthService from '../services/health/app-health.service';
import { ComponentState as AppState} from '../../libraries/managed-stateful-component';
import DefaultStatusCodeInterceptor from '../../infrastructure/interceptors/status-code.interceptor';
import ModuleStateHealthIndicator from '../health-indicators/module-state-health-indicator';
import Public from '../../infrastructure/decorators/public.decorator';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';

/**
 * Controller for serving health check requests
 * 
 * @remark This controller is used to check the health of the micoservice, e.g. by load balancers or monitoring tools.
 * @remark Uses 'z' suffix for health check endpoints intended for automated health checks
 * - E.g. /healthz, /readinessz, /livenessz
 * - This is a common convention in Kubernetes and other container orchestration platforms
 * - This reserves the /health endpoint for human-readable status pages
 * @remark The health check endpoints are public and do not require authentication, as they are
 *  intended for automated health checks that typically run without authentication.
 * 
 * @todo Figure out which endpoints should also return richer information, e.g. in JSON format
 * @todo Decide whether to use terminus and combine with own stateful component, or use own stateful component only
 * @todo Make sure we have endpoints meeting common conventions for health checks in Kubernetes and other container orchestration platforms
 * @todo Add a status page that shows the health of all services and dependencies (later)
 */
@ApiTags('health')
@Controller('health') // version prefix set in main.ts
@UseInterceptors(
	new DefaultStatusCodeInterceptor(200),
	//new HeadersInterceptor({ 'Cache-Control': 'no-cache, no-store, must-revalidate' })
)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) // whitelisting ignored with primitive types
export class AppHealthController {
	constructor(
		private readonly appDomainStateManager: AppDomainStateManager,
		private readonly appHealthService: AppHealthService,
		private readonly disk: DiskHealthIndicator,
		private readonly healthCheckService: HealthCheckService,
		private readonly memory: MemoryHealthIndicator,
		private readonly moduleStateHealthIndicator: ModuleStateHealthIndicator,
	) {}

	// Health check: Returns 200 if healthy, 503 if degraded/unavailable
	@Get('healthz')
	@ApiOperation({
		summary: 'Health check',
		description: 'Returns HTTP 200 if the app is healthy, HTTP 503 if degraded/unavailable. Used by load balancers and monitoring tools. Also returns the health status and reason for unavailability in the response body.'
	})
	@ApiResponse({ status: 200, description: 'The app is healthy' })
	async checkHealth(@Res() res: Response) {
		const { state, reason } = await this.appHealthService.getState(); // todo: needs refactoring to generate relevant return value
		
		if (state as unknown as AppState === AppState.OK) {
			res.status(HttpStatus.OK).send({ state });
		} else {
			res.status(HttpStatus.SERVICE_UNAVAILABLE).send({ state, reason });
		}
	}

	@Get('/readinessz')
	@ApiOperation({
		summary: 'Readiness check',
		description: 'Checks if the application and its dependencies are ready to receive traffic. Returns HTTP 200 if ready, 503 if not ready.'
	})
	@ApiResponse({ status: 200, description: 'Application is ready' })
	@ApiResponse({ status: 503, description: 'Application is not ready' })
	public async isReady(@Res() res: Response) {
		try {
			const healthCheck = await this.healthCheckService.check([ // expects an array of promises
				() => this.moduleStateHealthIndicator.isHealthy(this.appDomainStateManager),
				() => this.disk.checkStorage('storage', { path: process.cwd(), thresholdPercent: 0.5 }),
				() => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150 MB
				() => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150 MB
				// Add other health indicators here if/when needed
			]) as HealthCheckResult;
			
			if (healthCheck.status === 'ok') {
				return res.status(HttpStatus.OK).send(healthCheck);
			} else {
				return res.status(HttpStatus.SERVICE_UNAVAILABLE).send(healthCheck);
			}
		} catch (error) {
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'down',
				error: error.message,
				moduleState: {
					status: 'down',
					message: 'Error checking module state'
				}
			});
		}
	}
	
	@Get('livenessz')
	@Public()
	@ApiOperation({
	summary: 'Liveness probe',
	description: 'Simple probe that returns 200 if the application is running. Used to detect if the process has crashed or deadlocked.'
	})
	@ApiResponse({ status: 200, description: 'Application is running' })
	checkLiveness() {	
		return { status: 'ok' }; // No need for response injection - keep it simple
	}

	@Get('/startupz')
	@Public()
	@ApiOperation({
	summary: 'Startup probe',
	description: 'Indicates whether the application has completed its startup process. Used by Kubernetes to know when to start running liveness and readiness probes.'
	})
	@ApiResponse({ status: 200, description: 'Application startup is complete' })
	@ApiResponse({ status: 503, description: 'Application is still starting up' })
	async checkStartup(@Res() res: Response) {
		const isStarted = await (this.appHealthService as any).hasCompletedStartup(); // todo: refactor to use a proper method
		if (isStarted) {
			return res.status(HttpStatus.OK).send({ status: 'started' });
		}
		else {
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({ 
				status: 'starting',
				message: 'Application is still initializing'
			});
		}
	}
}
export default AppHealthController;