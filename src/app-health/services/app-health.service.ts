import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import * as path from 'path';

import { ComponentState } from '../../libraries/managed-stateful-component';
import AppDomainStateManager from '../../app-domain-state-manager';
import HealthCheckResponse from '../../conditioning/controllers/models/health-check-response.model';
import { HealthConfig, ServiceConfig } from '../../shared/domain/config-options.model';
import LivenessCheckResponse from '../../conditioning/controllers/models/liveliness-check-response.model';
import ModuleStateHealthIndicator from '../health-indicators/module-state-health-indicator';
import ReadinessCheckResponse from '../../conditioning/controllers/models/readiness-check-response.model';
import StartupCheckResponse from '../../conditioning/controllers/models/startup-check-response.model';

/**
 * 
 * This service generates data for health check responses from the application.
 * 
 * @remark It is used by the {@link AppHealthController} to provide data for all health check endpoints (/healthz, /livenessz, /readinessz, /startupz).
 * @remark It generates the health data but leaves timeout management to the controller.
 * 
 * @todo Retire existing implementation, as it no longer fits the requirements of the health check controller.
 * @todo Later, revisit need to directly manipulate state, e.g. during initialization in app module
 * 
 */
@Injectable()
export class AppHealthService {
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//
	
	constructor(
		private readonly appDomainStateManager: AppDomainStateManager,
		private readonly config: ConfigService,
		private readonly disk: DiskHealthIndicator,
		private readonly healthCheckService: HealthCheckService,
		private readonly http: HttpHealthIndicator,
		private readonly memory: MemoryHealthIndicator,
		private readonly moduleStateHealthIndicator: ModuleStateHealthIndicator,
	) {}

	//--------------------------------------- PUBLIC API ---------------------------------------//

	/**
	 * Returns the overall health status of the application
	 */
	public async fetchHealthCheckResponse(): Promise<HealthCheckResponse> {
		const now = new Date();
		const stateInfo = await this.appDomainStateManager.getState();
		
		if (!stateInfo) {
			throw {
				status: 'down',
				error: { message: 'Application state is not available' },
				timestamp: now.toISOString()
			};
		}

		delete stateInfo.components; // remove components to avoid sending too much data in the response
		const status = stateInfo.state === ComponentState.OK ? 'up' : 'down';
		
		return {
			status,
			info: { app: { status, state: stateInfo } },
			timestamp: (stateInfo.updatedOn ?? now).toISOString(),
		};
	}

	/**
	 * Returns the liveness status of the application
	 */
	public async fetchLivenessCheckResponse(): Promise<LivenessCheckResponse> {
		return { status: 'up', timestamp: new Date().toISOString() } as LivenessCheckResponse;
	}

	/**
	 * Returns the readiness status of the application with detailed component status
	 */
	public async fetchReadinessCheckResponse(): Promise<ReadinessCheckResponse> {
		const now = new Date();
		let healthCheck: HealthCheckResult;
		
		try {
			const healthConfig: HealthConfig = this.getHealthConfig();
			const servicesConfig = this.config.get<{ [key: string]: ServiceConfig }>('services') || {};
			
			healthCheck = await this.healthCheckService.check([
				// Internal checks
				() => this.moduleStateHealthIndicator.isHealthy(this.appDomainStateManager),
				() => this.disk.checkStorage('storage', { 
					path: path.normalize(healthConfig.storage.dataDir), 
					thresholdPercent: healthConfig.storage.maxStorageLimit 
				}),
				() => this.memory.checkHeap('memory_heap', healthConfig.memory.maxHeapSize),
				() => this.memory.checkRSS('memory_rss', healthConfig.memory.maxRSSsize),
				
				// External checks
				() => this.http.pingCheck('fitnessapp-registry-service', this.getServiceURL('fitnessapp-registry-service', servicesConfig)),
				() => this.http.pingCheck('fitnessapp-authentication-service', this.getServiceURL('fitnessapp-authentication-service', servicesConfig)),
				() => this.http.pingCheck('fitnessapp-user-service', this.getServiceURL('fitnessapp-user-service', servicesConfig)),
			]);
		}
		catch (healthCheckError) {
			healthCheck = healthCheckError?.response;
			throw healthCheck;
		}

		return this.mapHealthCheckResultToReadinessResponse(healthCheck, now);
	}

	/**
	 * Returns the startup status of the application
	 */
	public async fetchStartupCheckResponse(): Promise<StartupCheckResponse> {
		const now = new Date();
		const stateInfo = await this.appDomainStateManager.getState();
		
		if (!stateInfo) {
			throw {
				status: 'starting',
				message: 'Application state is not available',
				timestamp: now.toISOString()
			};
		}

		return {
			status: stateInfo.state === ComponentState.OK || stateInfo.state === ComponentState.DEGRADED ? 'started' : 'starting',
			timestamp: (stateInfo.updatedOn ?? now).toISOString()
		};
	}
	
	/*
	 * Get the current health configuration, overriding defaults with configured values
	 * 
	 */
	public getHealthConfig(): HealthConfig {
		const defaultConfig: HealthConfig = {
			storage: {
				dataDir: path.join('D:\\'),
				maxStorageLimit: 0.9,
			},
			memory: {
				maxHeapSize: 10 * 150 * 1024 * 1024,
				maxRSSsize: 10 * 150 * 1024 * 1024,
			},
			timeouts: {
				healthz: 2500,
				livenessz: 1000,
				readinessz: 5000,
				startupz: 2500
			}
		};
		
		const retrievedConfig: HealthConfig = this.config.get<HealthConfig>('health') || {} as unknown as HealthConfig;
		const mergedConfig = this.mergeConfig(defaultConfig, retrievedConfig, this);

		return mergedConfig as HealthConfig;
	}

	/**
	 * Maps a HealthCheckResult to a ReadinessCheckResponse
	 * 
	 * @param healthCheck The health check result to map
	 * @param now The current date and time for the response timestamp
	 * @return A ReadinessCheckResponse object containing the mapped health check data
	 * 
	 * @remark This method formats the health check result into a standardized response format for readiness checks.
	 * @remark It includes the status, info, error details, and a timestamp.
	 * @remark It also ensures that module state information is included in a consistent format.
	 * @remark The status is set to 'up' if the health check is 'ok', otherwise it is set to 'down'.
	 * @remark Public to avoid duplicating the logic in the controller, but not otherwise intended for external use.
	 */
	public mapHealthCheckResultToReadinessResponse(healthCheck: HealthCheckResult, now: Date): ReadinessCheckResponse {
		const status = healthCheck.status === 'ok' ? 'up' : 'down';

		const info = healthCheck.info || {};
		if (info['module-state']) {
			info['module-state'] = { status: info['module-state'].status || 'unknown' };
		}

		const error = healthCheck.error || {};
		if (error['module-state']) {
			error['module-state'] = {
				status: error['module-state']?.status || 'unknown',
				reason: error['module-state']?.reason || 'Unknown error'
			};
		}

		return {
			status,
			info,
			error,
			details: healthCheck.details ?? {},
			timestamp: now.toISOString()
		};
	}	

	//------------------------------------- PRIVATE METHODS -------------------------------------//

	/*
	 * Generates the health check URL for a service

	 * @param serviceName The name of the service to generate the URL for
	 * @param config The configuration object containing service details
	 * @return The full URL for the service's health check endpoint
	 * 
	 */
	private getServiceURL(serviceName: string, config: { [key: string]: ServiceConfig }): string {
		const baseURL = config[serviceName]?.baseURL?.href || `${serviceName}-base-url-not-configured`;
		const path = config[serviceName]?.endpoints?.liveness?.path || `/liveness-path-not-configured`;
		return `${baseURL}${path}`;
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
			if (!source) return target || {};
			target = target || {};
			
			const result = { ...target };
			
			for (const key in source) {
				if (source[key] instanceof Object && key in target) {
					result[key] = self.mergeConfig(target[key], source[key], self);
				}
				else {
					result[key] = source[key];
				}
			}  
			return result;
	}
}

export default AppHealthService;