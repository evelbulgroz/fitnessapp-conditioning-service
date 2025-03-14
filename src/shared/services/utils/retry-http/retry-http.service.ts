import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

import { Logger } from '@evelbulgroz/ddd-base';

import { EndPointConfig, ServiceConfig } from '../../../domain/config-options.model';

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
			const endpointConfig = this.getRetryConfig(error?.config?.url!);
			return endpointConfig?.retryConfig?.retryDelay ?? 1000; // Use endpoint-specific delay or default to 1000ms
		},
		retryCondition: (error: AxiosError) => {
			const endpointConfig = this.getRetryConfig(error?.config?.url!);
			const maxRetries = endpointConfig?.retryConfig?.maxRetries ?? 3;

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

	private getRetryConfig(url: string) {
		//console.debug('url', url);
		const serviceName = this.getServiceNameFromURL(url);
		//console.debug('serviceName:', serviceName);
		if (!serviceName) {
			return undefined;
		}
		const services = this.configService.get('services');
		const serviceConfig = services[serviceName!];
		//console.debug('serviceConfig:', serviceConfig);			
		for (const endpointName in serviceConfig.endpoints) {
			const endpointConfig = serviceConfig.endpoints[endpointName];
			//console.debug('endpointConfig:', endpointConfig);
			if (url.includes(endpointConfig.path)) {
				console.debug('found endpointConfig:', endpointConfig);
				return endpointConfig;
			}
		}
		return undefined;
	}

	private getServiceNameFromURL(url: string): string | undefined {
		console.debug('url', url);
		console.debug('configService:', this.configService); // bug: configService is mocked in test
		const services = this.configService.get('services'); // - resulting in undefined here
		console.debug('services:', services);
		for (const serviceName in services) {
			console.debug('serviceName:', serviceName);
			const serviceConfig = services[serviceName];
			console.debug('baseURL:', serviceConfig.baseURL.href);
			if (url.includes(serviceConfig.baseURL.href)) {
				return serviceName;
			}
		}
		return undefined;
	}
}

export default RetryHttpService;