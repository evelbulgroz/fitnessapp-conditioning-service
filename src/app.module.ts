import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Module }  from '@nestjs/common';
import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

import { ConsoleLogger, Logger }  from '@evelbulgroz/ddd-base';

import AuthenticationModule from './authentication/authentication.module';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import UserController  from './user/controllers/user.controller';
import UserModule from './user/user.module';

import productionConfig from './../config/production.config';
import developmentConfig from '../config/development.config';


// todo: Copy over (de)registration logic from API Gateway to be able to effectively authenticate and collaborate with other microservices
@Global()
@Module({
	imports: [
		HttpModule,
		ConfigModule.forRoot({
			load: [() => {				
				// conditionally load config based on environment
				// note: test config is loaded by test-utils.ts,
				//  as the app module is not used in unit tests
				return process.env.NODE_ENV === 'production' ? productionConfig() : developmentConfig();
			}],
			isGlobal: true,
		}),
		ConditioningModule,
		UserModule,
		AuthenticationModule,
	],
	controllers: [
		ConditioningController,
		UserController
	],
	providers: [		
		ConfigService,
		EventDispatcherService,
		{
			provide: Logger,
			useClass: ConsoleLogger,
		},
		{ // Provide HttpModule with retry logic
			provide: HttpModule,
			useFactory: (httpService: HttpService, configService: ConfigService) => {
			const axiosInstance = httpService.axiosRef;

			axiosRetry(axiosInstance, {
				retries: (retryCount: number, error: AxiosError) => {
					void retryCount; // suppress unused variable warning
					const endpointConfig = getRetryConfig(error?.config?.url!, configService);
					return endpointConfig?.retryConfig?.maxRetries ?? 3;
				},
				retryDelay: (retryCount: number, error) => {
					void retryCount; // suppress unused variable warning
					const endpointConfig = getRetryConfig(error?.config?.url!, configService);
					return endpointConfig?.retryConfig?.retryDelay ?? 1000;
				},
				retryCondition: (error: AxiosError) => {
					// Retry on network errors or 5xx status codes
					return axiosRetry.isNetworkOrIdempotentRequestError(error) || error?.response?.status! >= 500;
				},
			});
	
			return httpService;
			},
			inject: [HttpService, ConfigService],
		},
	],
	exports: [
		AuthenticationModule,
		ConditioningModule,
		ConfigModule,
		EventDispatcherService,
		Logger,		
		UserModule,
	]
})
export class AppModule {}


/**
 * Get the endpoint configuration for a given URL when an error occurs during an HTTP request
 * @param url The URL to check for an endpoint configuration
 * @param configService The ConfigService instance
 * @returns The endpoint configuration, or null if not found
 * @todo Get retry config from endpoint, service or global defaults, return RetryConfig
 */
function getRetryConfig(url: string, configService: ConfigService) {
	const services = configService.get('services');
	for (const serviceName in services) {
		const service = services[serviceName];
		for (const endpointName in service.endpoints) {
			const endpoint = service.endpoints[endpointName];
			if (url.includes(endpoint.path)) {
				return endpoint;
			}
		}
	}
	return null;
}