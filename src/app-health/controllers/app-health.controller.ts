import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Controller, Get, HttpStatus, Res, UseInterceptors, UsePipes } from '@nestjs/common';
import { HealthCheckResult } from '@nestjs/terminus';
import { Response } from 'express';

import * as path from 'path';

import AppHealthService from '../services/app-health.service';
import DefaultStatusCodeInterceptor from '../../infrastructure/interceptors/status-code.interceptor';
import HeadersInterceptor from '../../infrastructure/interceptors/headers-interceptor';
import HealthCheckResponse from '../../conditioning/controllers/models/health-check-response.model';
import LivenessCheckResponse from '../../conditioning/controllers/models/liveliness-check-response.model';
import Public from '../../infrastructure/decorators/public.decorator';
import { HealthConfig } from '../../shared/domain/config-options.model';
import StartupCheckResponse from '../../conditioning/controllers/models/startup-check-response.model';
import ReadinessCheckResponse from '../../conditioning/controllers/models/readiness-check-response.model';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';

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
		private readonly appHealthService: AppHealthService,
		private readonly config: ConfigService,
	) {}

	@Get('healthz')
	@Public()
	@ApiOperation({
		summary: 'Health check',
		description: `Returns HTTP 200 if the app is healthy, HTTP 503 if degraded/unavailable.
		Used by load balancers and monitoring tools.
		Also returns the health status and reason for unavailability in the response body.
		Times out with HTTP 503 after a configurable delay (default 2.5 seconds).`
	})
	@ApiResponse({ 
		status: 200, 
		description: 'The app is healthy',
		type: HealthCheckResponse
	})
	@ApiResponse({ 
		status: 503, 
		description: 'The app is degraded or unavailable',
		type: HealthCheckResponse 
	})
	async checkHealth(@Res() res: Response) {
		// Get the current time for the response timestamp
		const now = new Date();
		const timeout = this.getHealthConfig().timeouts.healthz || 2500; // Default to 2.5 seconds if not configured
		
		try {
			// Wrap data retrieval in a promise with a timeout
			const dataPromise = this.appHealthService.fetchHealthCheckResponse();
			const body = await this.withTimeout<HealthCheckResponse>(dataPromise, this.getHealthConfig().timeouts.healthz);
			
			if (body.status === 'up') {
				res.status(HttpStatus.OK).send(body);
			}
			else {
				body.error!.message = body.error?.message || 'The app is degraded or unavailable';
				res.status(HttpStatus.SERVICE_UNAVAILABLE).send(body);
			}
		} 
		catch (error) {
			const isTimeout = error.message?.includes('timed out');
			
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'down',
				error: isTimeout 
				? `Health check timed out after ${timeout}ms` 
				: (error.message || 'Error checking app health'),
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
	@ApiResponse({
		status: 200,
		description: 'Application is running',
		type: LivenessCheckResponse
	})
	@ApiResponse({
		status: 503,
		description: 'Application is not running'
	})
	public async checkLiveness(@Res() res: Response) {	
		const now = new Date(); // Get the current time for the response timestamp
		const timeout = this.getHealthConfig().timeouts.livenessz || 1000; // Default to 1 second if not configured

		try {
			// Wrap data retrieval from service in a promise with a timeout
			const dataPromise = this.appHealthService.fetchLivenessCheckResponse();
			const body = await this.withTimeout<LivenessCheckResponse>(dataPromise, this.getHealthConfig().timeouts.livenessz);			
			return body;
		}
		catch (error) {
			// Differentiate timeout errors from other errors
			const isTimeout = error.message?.includes('timed out');
			
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'down',
				error: isTimeout 
					? `Liveness check timed out after ${timeout}ms` 
					: (error.message || 'Error checking application liveness'),
				timestamp: now.toISOString()
			});
		}
	}

	@Get('/readinessz')
	@Public()
	@ApiOperation({
		summary: 'Readiness check',
		description: `Checks if the application and its dependencies are ready to receive traffic.
		Returns HTTP 200 if ready, 503 if not ready.
		Body includes comprehensive ReadinessCheckResponse.
		Times out with HTTP 503 after a configurable delay (default 5.0 seconds).`
	})
	@ApiResponse({
		status: 200,
		description: 'Application is ready.',
		type: ReadinessCheckResponse
	})	
	@ApiResponse({
		status: 503,
		description: 'Application is not ready.',
		type: ReadinessCheckResponse
	})
	public async checkReadiness(@Res() res: Response) {		
		const now = new Date();	// Get the current time for the response timestamp
		const timeout = this.getHealthConfig().timeouts.readinessz || 5000; // Default to 5 seconds if not configured

		try {
			// Wrap data retrieval in a promise with a timeout
			const dataPromise = this.appHealthService.fetchReadinessCheckResponse();
			const body = await this.withTimeout<ReadinessCheckResponse>(dataPromise, this.getHealthConfig().timeouts.readinessz);
			return res.status(body.status === 'up'? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).send(body);
		}
		catch (error) {
			let body: ReadinessCheckResponse;
			const isTimeout = error.message?.includes('timed out');			
			if (isTimeout) {
				body = {
					status: 'down',
					info: {},
					error: {message: `Readiness check timed out after ${timeout}ms`},
					timestamp: now.toISOString()
				};
			}
			else {
				const isHealthCheckResult = Object.keys(error).reduce((acc, key) => {
					acc = (['status', 'info', 'error', 'details', 'timestamp'].includes(key)) ? true : acc;
					return acc;
				}, false);
				
				if (isHealthCheckResult) {
					body = this.appHealthService.mapHealthCheckResultToReadinessResponse(error as HealthCheckResult, now);
				}
				else {
					body = {
						status: 'down',
						info: {},
						error: { message: error.message || 'Error checking application readiness' },
						timestamp: now.toISOString()
					};
				}				
			}
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send(body);
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
	@ApiResponse({
		status: 200,
		description: 'Application startup is complete',
		type: StartupCheckResponse
	})
	@ApiResponse({
		status: 503,
		description: 'Application is still starting up',
		type: StartupCheckResponse
	})
	public async checkStartup(@Res() res: Response) {
		const now = new Date();
		const timeout = this.getHealthConfig().timeouts.startupz || 2500; // Default to 2.5 seconds if not configured

		try {
			// Wrap data retrieval in a promise with a timeout
			const dataPromise = this.appHealthService.fetchStartupCheckResponse();
			
			const body = await this.withTimeout<StartupCheckResponse>(dataPromise, timeout);
			return res.status(body.status === 'started' ? HttpStatus.OK: HttpStatus.SERVICE_UNAVAILABLE).send(body);
			
		} 
		catch (error) {
			// Differentiate timeout errors from other errors
			const isTimeout = error.message?.includes('timed out');
			
			return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
				status: 'starting',
				message: isTimeout 
					? `Startup check timed out after ${timeout}ms` 
					: (error.message || 'Error checking application startup status'),
				timestamp: now.toISOString()
			});
		}
	}

	/*
	 * Get the health configuration, merging defaults with configured values
	 */
	private getHealthConfig(): HealthConfig {
		// Merge the default health configuration with the retrieved configuration (if any), prioritizing the retrieved configuration.
		const defaultConfig: HealthConfig = {
			storage: {
				dataDir: path.join('D:\\'), // Default data directory
				maxStorageLimit: 0.9, // 90% of available storage
			},
			memory: {
				maxHeapSize: 10 * 150 * 1024 * 1024, // 1500 MB
				maxRSSsize: 10 * 150 * 1024 * 1024, // 1500 MB
			},
			timeouts: {
				healthz: 2500, // 2.5 seconds
				livenessz: 1000, // 1 second
				readinessz: 5000, // 5 seconds
				startupz: 2500 // 2.5 seconds
			}
		};
		const retrievedConfig: HealthConfig = this.config.get<HealthConfig>('health') || {} as unknown as HealthConfig;		
		const mergedConfig = this.mergeConfig(defaultConfig, retrievedConfig, this) as HealthConfig;
		
		return mergedConfig;
	}

	/*
	 * Merge two simple configuration objects recursively
	 * 
	 * @param target The target configuration object to merge into
	 * @param source The source configuration object to merge from
	 * @param self Reference to the current instance, used for recursive calls
	 * 
	 * @returns A new configuration object that is the result of merging the two
	 * 
	 * @remark This method is used to combine default health configurations with any user-defined configurations.
	 * @remark It handles nested objects but does not handle arrays or other complex types.
	 */
	private mergeConfig(target: Record<string,any>, source: Record<string,any>, self = this): Record<string,any> {
			if (!source) return target;
			
			const result = { ...target };
			
			for (const key in source) {
				if (source[key] instanceof Object && key in target) {
					result[key] = self.mergeConfig(target[key], source[key]);
				}
				else {
					result[key] = source[key];
				}
			}  
			return result;
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
		// Create rejection promise that triggers after timeoutMs
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Operation timed out after ${timeoutMs}ms`));
			}, timeoutMs);
		});
			
		// Race the original promise against the timeout
		return Promise.race([promise, timeoutPromise]);
	}
}
export default AppHealthController;

