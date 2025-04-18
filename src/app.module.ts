import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Module }  from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AppHealthModule } from './app-health/app-health.module';

import { Logger, LogLevel }  from '@evelbulgroz/logger';

import AuthenticationModule from './authentication/authentication.module';
import AuthService from './authentication/domain/auth-service.class';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import NestLogger from './shared/logger/nest-logger';
import RegistrationService from './authentication/services/registration/registration.service';
import RetryHttpService from './shared/services/utils/retry-http/retry-http.service';
import SwaggerController from './api-docs/swagger.controller';
import TokenService from './authentication/services/token/token.service';
import UserController  from './user/controllers/user.controller';
import UserModule from './user/user.module';

import productionConfig from './../config/production.config';
import developmentConfig from '../config/development.config';

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
		AppHealthModule,
	],
	controllers: [
		ConditioningController,
		SwaggerController,
		UserController
	],
	providers: [		
		ConfigService,
		EventDispatcherService,
		{ // Logger compatible with ddd-base library
			provide: Logger,
			useFactory(configService: ConfigService) {
				const logLevel = configService.get<string>('log.level') ?? 'debug';
				const appName = configService.get<string>('log.appName') ?? 'conditioning-service';
				const addLocalTimestamp = configService.get<boolean>('log.addLocalTimestamp') ?? false;	
				const useColors = configService.get<boolean>('log.useColors') ?? true;
				return new NestLogger(logLevel as LogLevel, appName, undefined, addLocalTimestamp, useColors);
			},
			inject: [ConfigService],
		},
		RegistrationService,
		{ // AuthService
			// Provide the TokenService implementation of the AuthService interface
			provide: AuthService,
			useClass: TokenService

		},		
		{ // RetryHttpService
			provide: RetryHttpService,
			useFactory: (configService: ConfigService, logger: Logger) => {
				return new RetryHttpService(configService, logger);
			},
			inject: [ConfigService, Logger],
		},
		{ // HttpService
			provide: HttpService,
			useExisting: RetryHttpService, // Use the same instance as RetryHttpService
		},
		
		{ // AXIOS_INSTANCE_TOKEN
			// Provide AxiosInstance for use in RetryHttpService			
			provide: 'AXIOS_INSTANCE_TOKEN',
			useFactory: () => {
				const axiosInstance: AxiosInstance = axios.create();	  
				return axiosInstance;
			},
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
export class AppModule {
	private readonly appConfig: any;
	
	constructor(
		private readonly configService: ConfigService,
		private readonly logger: Logger,
		private readonly registrationService: RegistrationService,
		private readonly authService: AuthService
	) {
		this.appConfig = this.configService.get<any>('app') ?? {};
	}	

	/** Initialize the server by logging in to the auth service and registering with the microservice registry
	 * @returns Promise that resolves to void when the server initialization is complete
	 * @throws Error if initialization fails
	 * @todo Fail with warning, rather than error, if initialization fails, e.g. to support manual testing and graceful degradation
	 * @todo Add an app controller with a health check endpoint, backed by service, to check if server is initialized and running
	 * @todo Add "degraded" status to health check endpoint if initialization fails
	 */
	public async onModuleInit() {
		this.logger.log('Initializing server...', `${this.constructor.name}.onModuleInit`);
		// todo : set health check status to initializing

		// Log in to the auth microservice (internally gets and stores access token)
		try {
			void await this.authService.getAuthData();
		}
		catch (error) {
			this.logger.error(`Failed to get access token from auth microservice`, error, `${this.constructor.name}.onModuleInit`);
			this.logger.warn(`Continuing startup without authentication.`, `${this.constructor.name}.onModuleInit`);
			// todo: set health check status to degraded
		}
		
		// Register with the microservice registry (internally gets access token from auth service)
		try {
			void await this.registrationService.register();
		}
		catch (error) {
			this.logger.error(`Failed to register with microservice registry`, error, `${this.constructor.name}.onModuleInit`);
			this.logger.warn(`Continuing startup without registry registration.`, `${this.constructor.name}.onModuleInit`);
			// todo: set health check status to degraded
		}
		
		this.logger.log(`Server initialized with instance id ${this.appConfig.serviceid}`, `${this.constructor.name}.onModuleInit`);
	}

	/** Shut down the server by deregistering from the microservice registry and logging out from the auth service
	 * @returns Promise that resolves to void when the server has been shut down
	 * @throws Error if deregistration or logout fails
	 */
	public async onModuleDestroy() {
		this.logger.log('Destroying server...', `${this.constructor.name}.onModuleDestroy`);		
		// todo : set health check status to shutting down
		
		// Deregister from the microservice registry
		try {
			void await this.registrationService.deregister();
		}
		catch (error) {
			this.logger.error(`Failed to deregister from microservice registry`, error, `${this.constructor.name}.onModuleDestroy`);
			this.logger.warn(`Continuing shutdown without deregistration.`, `${this.constructor.name}.onModuleDestroy`);
			// todo: set health check status to degraded
		}

		// Log out from the auth microservice
		try {
			void await this.authService.logout();
		}
		catch (error) {
			this.logger.error(`Failed to log out from auth service`, error, `${this.constructor.name}.onModuleDestroy`);
			this.logger.warn('Continuing shutdown without logout.', `${this.constructor.name}.onModuleDestroy`);
			// todo: set health check status to degraded
		}

		this.logger.log('Server destroyed', `${this.constructor.name}.onModuleDestroy`);
		// todo : set health check status to destroyed
		// todo : close all connections and clean up resources
	}
}

export default AppModule;