import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Res, UseInterceptors, UsePipes } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Response } from 'express';

import * as path from 'path';

import AppDomainStateManager from '../../app-domain-state-manager';
import AppHealthService from '../services/health/app-health.service';
import { ComponentState as AppState } from '../../libraries/managed-stateful-component';
import DefaultStatusCodeInterceptor from '../../infrastructure/interceptors/status-code.interceptor';
import ModuleStateHealthIndicator from '../health-indicators/module-state-health-indicator';
import Public from '../../infrastructure/decorators/public.decorator';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';
import HealthCheckResponse from '../../conditioning/controllers/models/health-check-response.model';
import ReadinessCheckResponse from '../../conditioning/controllers/models/readiness-check-response.model';

/**
 * Controller for serving (mostly automated) app health check requests
 * 
 * @remark This controller is used to check the health of the micoservice, e.g. by load balancers or monitoring tools.
 * @remark Uses 'z' suffix for health check endpoints intended for automated health checks
 * - E.g. /healthz, /readinessz, /livenessz
 * - This is a common convention in Kubernetes and other container orchestration platforms
 * - This reserves the /health endpoint for human-readable status pages
 * @remark The health check endpoints are public and do not require authentication, as they are
 *  intended for automated health checks that typically run without authentication.
 * 
 * @todo Verify that we have comprehensive endpoints meeting common conventions for health checks in Kubernetes and other container orchestration platforms
 * @todo Move data processing to a service layer, so that the controller only handles HTTP requests and responses (later)
 * @todo Consider adding a hhtp health check to /readninessz that checks the HTTP response time of the app itself (later)
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

	@Get('healthz')
	@ApiOperation({
		summary: 'Health check',
		description: 'Returns HTTP 200 if the app is healthy, HTTP 503 if degraded/unavailable. Used by load balancers and monitoring tools. Also returns the health status and reason for unavailability in the response body.'
	})
	@ApiResponse({ status: 200, description: 'The app is healthy' })
	async checkHealth(@Res() res: Response) {
		const stateInfo = await this.appDomainStateManager.getState(); // returns a snapshot of the current top-level component state, does not recalculate it
		if (!stateInfo) {
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'down',
				error: 'The app state is not available'
			});
		}
		delete stateInfo?.components; // remove components to avoid sending too much data in the response

		const status = stateInfo.state === AppState.OK ? 'up' : 'down';
		const body: HealthCheckResponse = {
			status,
			info: {	app: { status, state: stateInfo } },
			timestamp: (stateInfo.updatedOn ?? new Date()).toISOString(),
		};
		
		if (status === 'up') {
			res.status(HttpStatus.OK).send({ body });
		}
		else {
			body.error = {error: stateInfo.reason || 'The app is degraded or unavailable'};
			res.status(HttpStatus.SERVICE_UNAVAILABLE).send({ body });
		}
	}

	@Get('/readinessz')
	@ApiOperation({
		summary: 'Readiness check',
		description: 'Checks if the application and its dependencies are ready to receive traffic. Returns HTTP 200 if ready, 503 if not ready. Body includes comprehensive ReadinessCheckResponse.'
	})
	@ApiResponse({ status: 200, description: 'Application is ready.' })
	@ApiResponse({ status: 503, description: 'Application is not ready.' })
	public async isReady(@Res() res: Response) {
		// Get the current time for the response timestamp
		const now = new Date();
		
		try {
			// Execute all health checks in parallel
			 // Note: HealthCheckService.check() expects an array of functions that return promises
			const healthCheck = await this.healthCheckService.check([
				() => this.moduleStateHealthIndicator.isHealthy(this.appDomainStateManager),
				// For now, we check persistence health indirectly via the PersistenceAdapter abstraction in the module state health indicator:
				  // So no direct database health check(s) here
				() => this.disk.checkStorage('storage', { path: path.normalize('D:\\'), thresholdPercent: 0.5 }),
				() => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150 MB, todo: get from config
				() => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150 MB, todo: get from config
				// ...add other health indicators here if/when needed
			]) as HealthCheckResult;

			// Process the health check result to fit the ReadinessCheckResponse format
			const status = healthCheck.status === 'ok' ? 'up' : 'down';
			
			const info = healthCheck.info || {};
			if (info['module-state']) { // Reduce the info to only include module state
				info['module-state'] = { status: info['module-state'].status || 'unknown', };
			}
			
			const error = healthCheck.error || {};
			if (error['module-state']) { // Reduce the error to only include module state
				error['module-state'] = { 
					status: error['module-state']?.status || 'unknown', 
					reason: error['module-state']?.reason || 'Unknown error' 
				};
			}
			
			const body: ReadinessCheckResponse = {				
				status,
				info,
				error,
				details: healthCheck.details ?? {},
				timestamp: now.toISOString()
			}

			// Return the response based on the overall status, including the body
			  // Note: The body will contain detailed information about the health of each component
			if (status === 'up') {
				return res.status(HttpStatus.OK).send(body);
			}
			else {
				return res.status(HttpStatus.SERVICE_UNAVAILABLE).send(body);
			}
		} catch (error) {
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'down',
				error: error.message,
				moduleState: {
					status: 'down',
					message: 'Error checking module state'
				},
				timestamp: now.toISOString()
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