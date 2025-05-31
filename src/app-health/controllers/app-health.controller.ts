import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Res, UseInterceptors, UsePipes } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Response } from 'express';

import * as path from 'path';

import { ComponentState, ComponentStateInfo } from '../../libraries/managed-stateful-component';

import AppDomainStateManager from '../../app-domain-state-manager';
import AppHealthService from '../services/health/app-health.service';
import DefaultStatusCodeInterceptor from '../../infrastructure/interceptors/status-code.interceptor';
import HeadersInterceptor from '../../infrastructure/interceptors/headers-interceptor';
import HealthCheckResponse from '../../conditioning/controllers/models/health-check-response.model';
import LivenessCheckResponse from '../../conditioning/controllers/models/liveliness-check-response.model';
import ModuleStateHealthIndicator from '../health-indicators/module-state-health-indicator';
import Public from '../../infrastructure/decorators/public.decorator';
import ReadinessCheckResponse from '../../conditioning/controllers/models/readiness-check-response.model';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';
import StartupCheckResponse from 'src/conditioning/controllers/models/startup-check-response.model';

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
 * @todo Move data processing to a service layer, so that the controller only handles HTTP requests and responses (next)
 * @todo Consider adding an Http health check to /readinessz that checks the HTTP response time of the app itself (later)
 * @todo Add a status page that shows the health of all services and dependencies (later)
 * @todo Add a /metrics endpoint that returns application metrics in a format suitable for Prometheus (later)
 */
@ApiTags('health')
@Controller('health') // version prefix set in main.ts
@UseInterceptors(
	new DefaultStatusCodeInterceptor(200),
	new HeadersInterceptor({
		'Cache-Control': 'no-cache, no-store, must-revalidate',
		'Pragma': 'no-cache',
		'Expires': '0',
		'X-Content-Type-Options': 'nosniff',
		//'X-Response-Time': `${Date.now() - requestStartTime}ms` // TODO: Would require timing logic
	})
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
		description: `Returns HTTP 200 if the app is healthy, HTTP 503 if degraded/unavailable.
		Used by load balancers and monitoring tools.
		Also returns the health status and reason for unavailability in the response body.
		Times out with HTTP 503 after a configurable delay (default 2.5 seconds).`
	})
	@ApiResponse({ status: 200, description: 'The app is healthy' })
	async checkHealth(@Res() res: Response) {
		// Get the current time for the response timestamp
		const now = new Date();
		
		try {
			// Wrap data retrieval in a promise with a timeout
			  // TODO: Replace dataPromise with call to data service, when available
			const dataPromise = new Promise<HealthCheckResponse>(async (resolve, reject) => {
				const stateInfo = await this.appDomainStateManager.getState();
				if (!stateInfo) {
					const body = {
						status: 'down',
						error: {message: 'Application state is not available'},
						timestamp: now.toISOString()
					};
					reject(body);
				}
				delete stateInfo?.components; // remove components to avoid sending too much data in the response
				const status = stateInfo.state === ComponentState.OK ? 'up' : 'down';
				const body: HealthCheckResponse = {
					status,
					info: {	app: { status, state: stateInfo } },
					timestamp: (stateInfo.updatedOn ?? now).toISOString(),
				};
				resolve(body);
			});
			const body = await this.withTimeout<HealthCheckResponse>(dataPromise, 2500); // 2.5 seconds timeout, todo: get from config
						
			if (body.status === 'up') {
				res.status(HttpStatus.OK).send(body);
			}
			else {
				body.error!.message = body.error?.message || 'The app is degraded or unavailable';
				res.status(HttpStatus.SERVICE_UNAVAILABLE).send(body);
			}
		} 
		catch (error) {
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'down',
				error: error.message || 'Error checking app health',
				timestamp: now.toISOString()
			});
		}
	}

	@Get('livenessz')
	@Public()
	@ApiOperation({
	summary: 'Liveness probe',
	description: `Simple probe that returns 200 if the application is running. Used to detect if the process has crashed or deadlocked.`
	})
	@ApiResponse({ status: 200, description: 'Application is running' })
	checkLiveness() {	
		const body: LivenessCheckResponse = { status: 'up' };
		return body; // No need for response injection - keep it simple
	}

	@Get('/readinessz')
	@ApiOperation({
		summary: 'Readiness check',
		description: `Checks if the application and its dependencies are ready to receive traffic.
		Returns HTTP 200 if ready, 503 if not ready.
		Body includes comprehensive ReadinessCheckResponse.
		Times out with HTTP 503 after a configurable delay (default 5.0 seconds).`
	})
	@ApiResponse({ status: 200, description: 'Application is ready.' })
	@ApiResponse({ status: 503, description: 'Application is not ready.' })
	public async isReady(@Res() res: Response) {		
		const now = new Date();	// Get the current time for the response timestamp
		try {
			// Wrap data retrieval in a promise with a timeout
			  // TODO: Replace dataPromise with call to data service, when available
			const dataPromise = new Promise<ReadinessCheckResponse>(async (resolve, reject) => {
				// Execute all health checks in parallel
				// Note: Throws an error if any of the checks fail, hence the need for additional try/catch
				let healthCheck: HealthCheckResult = {} as HealthCheckResult; // Initialize to avoid TS error
				try {
					healthCheck = await this.healthCheckService.check([ // expects an array of functions that return promises
						() => this.moduleStateHealthIndicator.isHealthy(this.appDomainStateManager),
						// For now, we check persistence health indirectly via the PersistenceAdapter abstraction in the module state health indicator:
						// So no direct database health check(s) here
						() => this.disk.checkStorage('storage', { path: path.normalize('D:\\'), thresholdPercent: 0.9 }), // 90% free space threshold, todo: get from config
						() => this.memory.checkHeap('memory_heap', 10 * 150 * 1024 * 1024), // 1500 MB, todo: get from config
						() => this.memory.checkRSS('memory_rss', 10* 150 * 1024 * 1024), // 1500 MB, todo: get from config
						// ...add other health indicators here if/when needed
					]) as HealthCheckResult;
				}
				catch (healthCheckError) {
					const healthCheck: HealthCheckResult = healthCheckError?.response; // check() throws a HealthCheckResult as the value of the response property of an object literal (very poorly documented)
					const body: ReadinessCheckResponse = {
						status: 'down',
						info: {},
						error: healthCheck?.error ?? { message: 'Error checking application readiness' },
						timestamp: now.toISOString()
					};
					reject(healthCheck);
				}

				const body: ReadinessCheckResponse = this.mapHealthCheckResultToReadinessResponse(healthCheck, now);
				resolve(body);				
			});
			const body = await this.withTimeout<ReadinessCheckResponse>(dataPromise, 5000); // 5 seconds timeout, todo: get from config
			return res.status(body.status === 'up'? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).send(body);
		}
		catch (error) {
			let body: ReadinessCheckResponse;
			const isTimeout = error.message?.includes('timed out');			
			if (isTimeout) {
				body = {
					status: 'down',
					info: {},
					error: {message: 'Readiness check timed out'},
					timestamp: now.toISOString()
				};
			}
			else {
				const isHealthCheckResult = Object.keys(error).reduce((acc, key) => {
					acc = (['status', 'info', 'error', 'details', 'timestamp'].includes(key)) ? true : acc;
					return acc;
				}, false);
				
				if (isHealthCheckResult) {
					body = this.mapHealthCheckResultToReadinessResponse(error as HealthCheckResult, now);
				}
				else {
					body = {
						status: 'down',
						info: {},
						error: { message: error.message || 'Error checking application readiness' },
						timestamp: now.toISOString()
					};
				}
				return res.status(HttpStatus.SERVICE_UNAVAILABLE).send(body);
			}
		}
	}

	@Get('/startupz')
	@Public()
	@ApiOperation({
		summary: 'Startup probe',
		description: `Indicates whether the application has completed its startup process.
		Returns HTTP 200 if the application is fully started, HTTP 503 if it is still starting up.
		Body includes a StartupCheckResponse with the current status and timestamp.
		Times out with HTTP 503 after a configurable delay (default 2.5 seconds).`
	})
	@ApiResponse({ status: 200, description: 'Application startup is complete' })
	@ApiResponse({ status: 503, description: 'Application is still starting up' })
	public async checkStartup(@Res() res: Response) {
		const now = new Date();
		
		try {
			// Wrap data retrieval in a promise with a timeout
			  // TODO: Replace dataPromise with call to data service, when available
			const dataPromise = new Promise<StartupCheckResponse>(async (resolve, reject) => {
				const stateInfo = await this.appDomainStateManager.getState();
				if (!stateInfo) {
					const body: StartupCheckResponse = {
						status: 'starting',
						message: 'Application state is not available',
						timestamp: now.toISOString()
					};
					reject(body);
				}

				const body: StartupCheckResponse = {
					status: stateInfo.state === ComponentState.OK || stateInfo.state === ComponentState.DEGRADED ? 'started' : 'starting',
					//message: stateInfo.reason || `Application is in state '${stateInfo.state}'`,
					timestamp: (stateInfo.updatedOn ?? now).toISOString()
				};
				resolve(body);
			});
			
			const body = await this.withTimeout<StartupCheckResponse>(dataPromise, 2500); // 2.5 seconds timeout, todo: get from config			
			return res.status(body.status === 'started' ? HttpStatus.OK: HttpStatus.SERVICE_UNAVAILABLE).send(body);
			
		} 
		catch (error) {
			// Differentiate timeout errors from other errors
			const isTimeout = error.message?.includes('timed out');
			
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'starting',
				message: isTimeout 
					? 'Startup check timed out' 
					: (error.message || 'Error checking application startup status'),
				timestamp: now.toISOString()
			});
		}
	}
	
	// TODO: Move this to a service layer, so that the controller only handles HTTP requests and responses (later)
	private mapHealthCheckResultToReadinessResponse(healthCheck: HealthCheckResult, now: Date): ReadinessCheckResponse {
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

		const response: ReadinessCheckResponse = {
			status,
			info,
			error,
			details: healthCheck.details ?? {},
			timestamp: now.toISOString()
		};

		return response;
	}

	/*
	 * Wrap a promise with a timeout
	 * 
	 * @param promise The original promise
	 * @param timeoutMs Timeout in milliseconds
	 * 
	 * @returns A promise that resolves with the original promise's result, or rejects with a timeout error
	 * 
	 * @remark This method is used to ensure that the health check operations timeout after a specified duration
	 * that clients can be configured for.
	 * 
	 * @example
	 * const someAsyncOperation = async () => {
	 *   // Simulate an async operation
	 *  return new Promise((resolve) => setTimeout(() => resolve('done'), 3000));
	 * }
	 * const result = await this.withTimeout(someAsyncOperation(), 5000);
	 */
	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
		});
		
		return Promise.race([promise, timeoutPromise]) as Promise<T>;
	}
}
export default AppHealthController;

