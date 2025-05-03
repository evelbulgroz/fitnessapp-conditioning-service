import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

import { StreamLoggableMixin } from '../../../../libraries/stream-loggable';

import { DefaultConfig, EndPointConfig, RetryConfig, ServiceConfig } from '../../../domain/config-options.model';

/** HttpService wrapper for making HTTP requests with automatic retry logic using axios-retry
 * @remark Uses the ConfigService to get retry configuration for each request
 * @remark Retry configuration is looked up in reverse hierarchical order: endpoint -> service -> app default
 * @remark Retry delays are exponential backoff with jitter to prevent synchronized retries
 */
@Injectable()
export class RetryHttpService extends StreamLoggableMixin(HttpService) {

	//--------------------------------------- CONSTRUCTOR ---------------------------------------//
	
	constructor(
		private readonly config: ConfigService,
	) {
		super();
		this.configureAxios();		
	}

	//---------------------------------- PROTECTED METHODS --------------------------------------//

	/* Configure axios-retry for the HttpService instance */
	protected configureAxios() {
		const axiosInstance = this.axiosRef;
		axiosRetry(axiosInstance, {
			retries: 25, // must add hardcoded default max retries here: should be higher than expected max retries for any endpoint
			retryCondition: (error: AxiosError) => {
				try {
					const retryConfig = this.getRetryConfig(error?.config?.url!);
					if (!retryConfig) {
						this.logger.warn(`No retry configuration found for URL: ${error?.config?.url}`, this.constructor.name);
						return false; // no retry config found, don't retry
					}
					const maxRetries = retryConfig?.maxRetries ?? 3;
					const currentRetryCount = (error?.config as any)?.['axios-retry']?.retryCount ?? 0; // get the current retry count from the error config
					const method = error?.config?.method;
					const statusCode = error?.response?.status || 'Network error or no response';
					
					this.logger.warn(`${method?.toUpperCase()} ${error?.config?.url} failed with ${statusCode}`, this.constructor.name);
					
					if (currentRetryCount >= maxRetries) { // only reached if maxRetries in config is less than axiosEntry.retries
						this.logger.warn(`Max retries (${maxRetries}) reached. Request failed.`, this.constructor.name);
						return false; // stop retrying if maxRetries is reached
					}

					const isRetryable = axiosRetry.isNetworkOrIdempotentRequestError(error) || error?.response?.status! >= 500;
					this.logger.log(`RetryCondition: ${isRetryable ? `Retrying (${currentRetryCount + 1} of ${maxRetries})  ...` : 'Not retrying'}`, this.constructor.name);

					return isRetryable;
				}
				catch (error) {
					this.logger.error('Error in retryCondition:', error, this.constructor.name);
					return false; // default to not retrying on error
				}
			},
			retryDelay: (retryCount: number, error: AxiosError) => {
				const retryConfig = this.getRetryConfig(error?.config?.url!);
				const baseDelay = retryConfig?.retryDelay ?? 1000; // Default base delay is 1 second

				// Exponential backoff
				let delay = baseDelay * Math.pow(2, retryCount - 1);

				// Add jitter to prevent synchronized retries
				const jitter = Math.random() * baseDelay; // Random value between 0 and baseDelay
				delay += jitter;

				return delay;
			},			
		});	
	}

	/* Get the retry configuration for a given URL
	 * @param url The URL of the request
	 * @returns The retry configuration for the URL
	 * @remark Looks up retry config in reverse hierarchal order: endpoint -> service -> app default
	 */
	protected getRetryConfig(url: string): RetryConfig | undefined {
		if (!url) { return undefined; }
		// check for endpoint-specific retry config
		const endpointConfig = this.getEndpointConfig(url);
		if (endpointConfig?.retry) {
			return endpointConfig.retry;
		}

		// check for service-specific retry config
		const serviceName = this.getServiceNameFromURL(url);
		if (!serviceName) {	return undefined; }
		const serviceConfig = this.getServicesConfig(serviceName);
		if (serviceConfig?.retry) {
			return serviceConfig.retry;
		}

		// use default retry config
		const defaultConfig = this.config.get('defaults') as DefaultConfig;
		if (defaultConfig.retry) {
			return defaultConfig.retry;
		}

		// no retry config found
		this.logger.warn(`No retry configuration found for URL: ${url}`);
		return undefined;

	}

	// Get the endpoint configuration for a given URL (helper for getRetryConfig)
	protected getEndpointConfig(url: string): EndPointConfig | undefined {
		const serviceName = this.getServiceNameFromURL(url);
		if (!serviceName) {	return undefined; }		
		const serviceConfig = this.getServicesConfig(serviceName);
		for (const endpointName in serviceConfig?.endpoints) {
			const endpointConfig = serviceConfig?.endpoints[endpointName];
			if (url.includes(endpointConfig.path)) {
				return endpointConfig;
			}
		}
		return undefined;
	}

	// Get the service configuration for a given service name (helper for getRetryConfig)
	protected getServicesConfig(serviceName: string): ServiceConfig | undefined {
		const services = this.config.get('services') || {};
		return services[serviceName];
	}

	// Get the service name by comparing a given URL to the base URL of each service (helper for getRetryConfig)
	protected getServiceNameFromURL(url: string): string | undefined {
		const services = this.config.get('services'); // bug: config service is not injected, so this will be undefined
		for (const serviceName in services) {
			const serviceConfig = services[serviceName];
			if (url.includes(serviceConfig?.baseURL?.href)) {
				return serviceName;
			}
		}
		return undefined;
	}
}

export default RetryHttpService;