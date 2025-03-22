import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

import { Logger } from '@evelbulgroz/ddd-base';

import { DefaultConfig, EndPointConfig, RetryConfig, ServiceConfig } from '../../../domain/config-options.model';

/** Service for making HTTP requests with automatic retry logic using axios-retry */
@Injectable()
export class RetryHttpService extends HttpService {
	constructor(
		private readonly configService: ConfigService,
		private readonly logger: Logger,
	) {
		super();
		this.configureAxios();
	}

	/* Configure axios-retry for the HttpService instance */
	protected configureAxios() {
		const axiosInstance = this.axiosRef;
		axiosRetry(axiosInstance, {
			retries: 25, // set a default maximum number of retries (must be hard-coded, overridden by config in retryCondition)
			retryCondition: (error: AxiosError) => {
				//console.debug('Retry condition called with error:', error.toString());
				const retryConfig = this.getRetryConfig(error?.config?.url!);
				//console.debug('retryConfig', retryConfig);				
				const maxRetries = retryConfig?.maxRetries ?? 3;
				const currentRetryCount = (error?.config as any)?.['axios-retry']?.retryCount ?? 0;
				
				// Log details about the retry condition
				this.logger.warn(`RetryCondition triggered for URL: ${error?.config?.url}`);
				this.logger.warn(`HTTP Status Code: ${error?.response?.status}`);
				this.logger.warn(`Current Retry Count: ${currentRetryCount}`);
				this.logger.warn(`Max Retries Allowed: ${maxRetries}`);
				this.logger.error(`Error Message: ${error.message}`);

				if (currentRetryCount >= maxRetries) {
					console.debug('Max retries reached. No further retries will be attempted.');
					this.logger.warn('RetryCondition: Max retries reached. No further retries will be attempted.');
					return false; // stop retrying if maxRetries is reached
				}

				const isRetryable = axiosRetry.isNetworkOrIdempotentRequestError(error) || error?.response?.status! >= 500;
				this.logger.warn(`Retry Reason: ${isRetryable ? 'Network error or 5xx status code' : 'Other'}`);

				return isRetryable;
			},
			retryDelay: (retryCount: number, error: AxiosError) => {
				console.debug('Retry delay called with retryCount:', retryCount, 'error:', error.toString());
				void retryCount; // suppress unused variable warning
				const retryConfig = this.getRetryConfig(error?.config?.url!);
				//console.debug('retryConfig', retryConfig);
				return retryConfig?.retryDelay ?? 1000; // Use endpoint-specific delay or default to 1000ms
			},			
		});		
	}

	/* Get the retry configuration for a given URL
	 * @param url The URL of the request
	 * @returns The retry configuration for the URL
	 * @remark Looks up retry config in reverse hierarchal order: endpoint -> service -> app default
	 */
	protected getRetryConfig(url: string): RetryConfig | undefined {
		//console.debug('getRetryConfig url', url);
		// Check for endpoint-specific retry config
		const endpointConfig = this.getEndpointConfig(url);
		if (endpointConfig?.retry) {
			return endpointConfig.retry;
		}

		// Check for service-specific retry config
		const serviceName = this.getServiceNameFromURL(url);
		if (!serviceName) {	return undefined; }
		const serviceConfig = this.getServiceConfig(serviceName);
		if (serviceConfig?.retry) {
			return serviceConfig.retry;
		}

		// Use default retry config
		const defaultConfig = this.configService.get('defaults') as DefaultConfig;
		if (defaultConfig.retry) {
			return defaultConfig.retry;
		}

		// No retry config found
		this.logger.warn(`No retry configuration found for URL: ${url}`);
		return undefined;

	}

	// Get the endpoint configuration for a given URL (helper for getRetryConfig)
	protected getEndpointConfig(url: string): EndPointConfig | undefined {
		const serviceName = this.getServiceNameFromURL(url);
		if (!serviceName) {	return undefined; }		
		const serviceConfig = this.getServiceConfig(serviceName)
		for (const endpointName in serviceConfig?.endpoints) {
			const endpointConfig = serviceConfig?.endpoints[endpointName];
			if (url.includes(endpointConfig.path)) {
				return endpointConfig;
			}
		}
		return undefined;
	}

	// Get the service configuration for a given service name (helper for getRetryConfig)
	protected getServiceConfig(serviceName: string): ServiceConfig | undefined {
		const services = this.configService.get('services');
		return services[serviceName];
	}

	// Get the service name by comparing a given URL to the base URL of each service (helper for getRetryConfig)
	protected getServiceNameFromURL(url: string): string | undefined {
		const services = this.configService.get('services');
		//console.debug('getServiceNameFromURL services', services);
		for (const serviceName in services) {
			const serviceConfig = services[serviceName];
			if (url.includes(serviceConfig.baseURL.href)) {
				return serviceName;
			}
		}
		return undefined;
	}
}

export default RetryHttpService;