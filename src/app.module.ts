import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryService } from '@nestjs/core';
import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Module, OnModuleDestroy, OnModuleInit }  from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { Subscription, } from 'rxjs';

import { DomainStateManager, filePathExtractor, FilePathExtractorOptions } from './libraries/managed-stateful-component';
import { MergedStreamLogger, StreamLoggableMixin } from "./libraries/stream-loggable";

import AppDomainStateManager from './app-domain-state-manager';
import AppHealthModule from './app-health/app-health.module';
import AuthenticationModule from './authentication/authentication.module';
import AuthService from './authentication/domain/auth-service.class';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
import DOMAIN_PATH_EXTRACTOR from './infrastructure/tokens/domain-path-extractor.token';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import LoggingModule from './logging/logging.module';
import RegistrationService from './authentication/services/registration/registration.service';
import RequestLoggingInterceptor from './infrastructure/interceptors/request-logging.interceptor';
import RetryHttpService from './shared/services/utils/retry-http/retry-http.service';
import SwaggerController from './api-docs/swagger.controller';
import TokenService from './authentication/services/token/token.service';
import UserController  from './user/controllers/user.controller';
import UserModule from './user/user.module';

import productionConfig from './../config/production.config';
import developmentConfig from '../config/development.config';
/**
 * Main module for the application.
 * 
 * This module serves as the entry point for the application and is responsible for
 * importing and configuring all other modules, services, and components.
 * 
 * It includes the following key features:
 * - Globally providing configuration and other widely used services
 * - Setting up state management and logging for the application
 * - Authenticating with the auth service and registering with the microservice registry
 * - More generally securing ordered initialization and shutdown of the application
 * 
 */
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
		LoggingModule,
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
		AppDomainStateManager,
		DiscoveryService,
		{ // DomainPathExtractor
			provide: DOMAIN_PATH_EXTRACTOR,
			useFactory: (configService: ConfigService) => {
			  // Get any config values you need
			  const config = configService.get('app') || {};
			  
			  // Create a preconfigured extractor with defaults from config
			  return (
				manager: DomainStateManager,
				options: Partial<FilePathExtractorOptions> = {}
			  ) => {
				return filePathExtractor(
					manager,
					{
						appRootName: config.appRootName || 'app',
						sourceRoot: config.sourceRoot || process.cwd(),
						separator: config.separator || '.'
			  		} as Partial<FilePathExtractorOptions>
				);
			  };
			},
			inject: [ConfigService]
		},
		EventDispatcherService,		
		RequestLoggingInterceptor,
		RegistrationService,
		{ // AuthService
			// Provide the TokenService implementation of the AuthService interface
			provide: AuthService,
			useClass: TokenService

		},		
		{ // RetryHttpService
			provide: RetryHttpService,
			useFactory: (configService: ConfigService) => {
				return new RetryHttpService(configService);
			},
			inject: [ConfigService],
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
		AppDomainStateManager,
		DiscoveryService,
		AuthenticationModule,
		ConditioningModule,
		ConfigModule,
		EventDispatcherService,
		LoggingModule,
		UserModule,
	]
})
export class AppModule extends StreamLoggableMixin(class {}) implements OnModuleInit, OnModuleDestroy {
	private readonly appConfig: any;
	private readonly subs: Subscription[] = [];
	
	constructor(
		private readonly configService: ConfigService,
		private readonly registrationService: RegistrationService,
		private readonly authService: AuthService,
		private readonly streamLogger: MergedStreamLogger,
		private readonly stateManager: AppDomainStateManager,
	) {
		super();
		this.appConfig = this.configService.get<any>('app') ?? {};
	}

	//-------------------------------------- LIFECYCLE HOOKS ---------------------------------------//

	/** Initialize the module and its components
	 * 
	 * @returns Promise that resolves to void when the module is fully initialized
	 * @throws Error if initialization fails
	 * 
	 * @todo Add error handling for initialization failures
	 */
	public async onModuleInit(): Promise<void> {
		// Set up logging
		this.initializeLogging();

		this.logger.info('Initializing server...', `${this.constructor.name}.onModuleInit`);
		
		// Initialize state management of the module and its components
		await this.stateManager.initialize();

		// Log in to the auth microservice (internally gets and stores access token)
		try {
			void await this.authenticate();
		}
		catch (error) {
			void error;
			// do nothing: authenticate() method handles error messaging and health check status
		}

		this.logger.info(`Server initialized with instance id ${this.appConfig.serviceid}`, `${this.constructor.name}.onModuleInit`);
		
		const sub = this.stateManager.componentState$.subscribe((state) => { // debugging	
			console.info({ name: state.name, state: state.state, reason: state.reason, });
		});
		this.subs.push(sub);
	};

	/** Clean up the module and its components
	 * 
	 * @returns Promise that resolves to void when the module is fully cleaned up
	 * @throws Error if cleanup fails
	 * 
	 * @todo Add error handling for cleanup failures
	 * @todo Add health check status updates for cleanup failures
	 */
	public async onModuleDestroy(): Promise<void> {
		this.logger.info('Destroying server...', `${this.constructor.name}.onModuleDestroy`);		
		
		// Shut down the module and its state managed subcomponents, if any
		await this.stateManager.shutdown();
		
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
		
		this.subs.forEach((sub) => { // debug
			sub && sub.unsubscribe();
		});		

		this.logger.info('Server destroyed', `${this.constructor.name}.onModuleDestroy`);

		this.streamLogger.unsubscribeAll();
	}

	//------------------------------------- MANAGEMENT API --------------------------------------//

	// NestJS modules cannot be managed by the state management system, no need to implement here.
	
	//------------------------------------- PRIVATE METHODS -------------------------------------//

	/*
	 * Authenticate with the auth service and register with the microservice registry
	 * 
	 * Registers with the microservice registry (internally gets and stores access token from auth service)
	 * 
	 * @todo Set health check status to degraded if authentication or registration fails
	 */
	private async authenticate() {
		try {
			console.debug(`Getting access token from auth microservice...`);
			void await this.authService.getAuthData();
		}
		catch (error) {
			console.debug(`Failed to get access token from auth microservice`);
			this.logger.error(`Failed to get access token from auth microservice`, error, `${this.constructor.name}.onModuleInit`);
			this.logger.warn(`Continuing startup without authentication.`, `${this.constructor.name}.onModuleInit`);
			// todo: set health check status to degraded
		}

		console.debug(`Continuing with initialization...`);

		// Register with the microservice registry (internally gets access token from auth service)
		try {
			console.debug(`Registering with microservice registry...`);
			void await this.registrationService.register();
			console.debug(`Successfully registered with microservice registry`);
		}
		catch (error) {
			console.debug(`Failed to register with microservice registry`);
			this.logger.error(`Failed to register with microservice registry`, error, `${this.constructor.name}.onModuleInit`);
			this.logger.warn(`Continuing startup without registry registration.`, `${this.constructor.name}.onModuleInit`);
			// todo: set health check status to degraded
		}
	}
	
	/* 
	 * Initialize logging for the module and its components.
	 * 
	 * This method subscribes to the log streams of the module and its components, allowing for centralized logging.
	 * It also logs the initialization status of the logging system.
	 */
	private initializeLogging() {
		this.streamLogger.subscribeToStreams([
			// For now, submodules handle their own logging, no need to subscribe to their components here
			// AppController, if provided, is not a managed component, so we don't subscribe to its componentState$ stream
			
			{ streamType: 'log$', component: this },
			{ streamType: 'log$', component: this.authService },
			// AppController: Cannot get a reference to the active instance here, so it subscribes itself (if needed)
		]);
		this.logger.info('Logging enabled', `${this.constructor.name}.onModuleInit`);
	}
}

export default AppModule;