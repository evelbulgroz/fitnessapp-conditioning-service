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
	super(); // todo: pass in axios instance token
	const axiosInstance = this.axiosRef;

	axiosRetry(axiosInstance, {
		retries: 3, // Set a default maximum number of retries
		retryDelay: (retryCount: number, error: AxiosError) => {
			void retryCount; // suppress unused variable warning
			const retryConfig = this.getRetryConfig(error?.config?.url!);
			return retryConfig?.retryDelay ?? 1000; // Use endpoint-specific delay or default to 1000ms
		},
		retryCondition: (error: AxiosError) => {
			const retryConfig = this.getRetryConfig(error?.config?.url!);
			const maxRetries = retryConfig?.maxRetries ?? 3;

			const currentRetryCount = (error?.config as any)?.['axios-retry']?.retryCount ?? 0;

			// Log details about the retry condition
			this.logger.warn(`RetryCondition triggered for URL: ${error?.config?.url}`);
			this.logger.warn(`HTTP Status Code: ${error?.response?.status}`);
			this.logger.warn(`Current Retry Count: ${currentRetryCount}`);
			this.logger.warn(`Max Retries Allowed: ${maxRetries}`);
			this.logger.error(`Error Message: ${error.message}`);

			if (currentRetryCount >= maxRetries) {
			this.logger.warn('RetryCondition: Max retries reached. No further retries will be attempted.');
			return false; // Stop retrying if maxRetries is reached
			}

			const isRetryable = axiosRetry.isNetworkOrIdempotentRequestError(error) || error?.response?.status! >= 500;
			this.logger.warn(`Retry Reason: ${isRetryable ? 'Network error or 5xx status code' : 'Other'}`);

			return isRetryable;
		},
	});
}

	private getRetryConfig(url: string): RetryConfig | undefined {
		// Look up retry config in reverse hierarchy: endpoint -> service -> default
		
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

	private getEndpointConfig(url: string): EndPointConfig | undefined {
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

	private getServiceConfig(serviceName: string): ServiceConfig | undefined {
		const services = this.configService.get('services');
		return services[serviceName];
	}

	private getServiceNameFromURL(url: string): string | undefined {
		const services = this.configService.get('services'); // - resulting in undefined here
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