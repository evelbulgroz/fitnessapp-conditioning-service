import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Module, OnModuleDestroy, OnModuleInit }  from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { ManagedStatefulComponentMixin } from './libraries/managed-stateful-component';
import { Logger, MergedStreamLogger, StreamLoggableMixin } from "./libraries/stream-loggable";

import AppHealthModule from './app-health/app-health.module';
import AuthenticationModule from './authentication/authentication.module';
import AuthService from './authentication/domain/auth-service.class';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
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
import { first, firstValueFrom, take } from 'rxjs';

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
		AuthenticationModule,
		ConditioningModule,
		ConfigModule,
		EventDispatcherService,
		LoggingModule,
		UserModule,
	]
})
export class AppModule  extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements OnModuleInit, OnModuleDestroy {
	private readonly appConfig: any;
	
	constructor(
		private readonly configService: ConfigService,
		private readonly registrationService: RegistrationService,
		private readonly authService: AuthService,
		private readonly streamLogger: MergedStreamLogger,
	) {
		super();
		this.appConfig = this.configService.get<any>('app') ?? {};
	}

	//-------------------------------------- LIFECYCLE HOOKS ---------------------------------------//

	/** Initialize the module and its components
	 * 
	 * @returns Promise that resolves to void when the module is fully initialized
	 * @throws Error if initialization fails
	 * @todo Add error handling for initialization failures
	 */
	public async onModuleInit(): Promise<void> {
		// Triggers ManagedStatefulComponentMixin to call onInitialize() in the correct order
		await this.initialize();

		const state = firstValueFrom(this.componentState$.pipe(take(1)));
		console.log('Component state:', JSON.stringify(state, null, 2)); // for debugging		
	};

	/** Clean up the module and its components
	 * 
	 * @returns Promise that resolves to void when the module is fully cleaned up
	 * @throws Error if cleanup fails
	 * @todo Add error handling for cleanup failures
	 */
	public async onModuleDestroy(): Promise<void> {
		// Triggers ManagedStatefulComponentMixin to call onShutdown() in the correct order
		await this.shutdown(); 
	}

	//------------------------------------- MANAGEMENT API --------------------------------------//

	/** Initialize the server by logging in to the auth service and registering with the microservice registry
	 * 
	 * @returns Promise that resolves to void when the server initialization is complete
	 * @throws Error if initialization fails
	 * @todo Fail with warning, rather than error, if initialization fails, e.g. to support manual testing and graceful degradation
	 * @todo Add an app controller with a health check endpoint, backed by service, to check if server is initialized and running
	 * @todo Add "degraded" status to health check endpoint if initialization fails
	 */
	public async onInitialize() {
		// Set up logging
		this.initializeLogging();

		this.logger.info('Initializing server...', `${this.constructor.name}.onModuleInit`);
		
		// Log in to the auth microservice (internally gets and stores access token)
		try {
			void await this.authenticate();
		}
		catch (error) {
			void error;
			// do nothing: authenticate() method handles error messaging and health check status
		}

		// Register subcomponents for lifecycle management
		//this.registerSubcomponent(this.conditioningModule);
		//this.registerSubcomponent(this.userModule);
		
		
		this.logger.info(`Server initialized with instance id ${this.appConfig.serviceid}`, `${this.constructor.name}.onModuleInit`);
	}

	/** Shut down the server by deregistering from the microservice registry and logging out from the auth service
	 * @returns Promise that resolves to void when the server has been shut down
	 * @throws Error if deregistration or logout fails
	 */
	public async onShutdown() {
		this.logger.info('Destroying server...', `${this.constructor.name}.onModuleDestroy`);		
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

		this.logger.info('Server destroyed', `${this.constructor.name}.onModuleDestroy`);
		// todo : set health check status to destroyed
		// todo : close all connections and clean up resources
	}
	
	//------------------------------------- PRIVATE METHODS -------------------------------------//

	/** Authenticate with the auth service and register with the microservice registry
	 * 
	 * Registers with the microservice registry (internally gets and stores access token from auth service)
	 * @todo Set health check status to degraded if authentication or registration fails
	 */
	private async authenticate() {
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
	}
	
	/* Initialize logging for the module and its components.
	 * 
	This method subscribes to the log streams of the module and its components, allowing for centralized logging.
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

/* Scaffold for implementing ManagedStatefulComponent interface
@Module({
  imports: [
    ConditioningModule,
    UserModule,
    // other modules
  ],
  providers: [AppHealthService]
})
export class AppModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly conditioningModule: ConditioningModule,
    private readonly userModule: UserModule,
    private readonly healthService: AppHealthService,
    private readonly logger: Logger
  ) {
    // Register modules with health service
    this.healthService.registerModule('conditioning', this.conditioningModule);
    this.healthService.registerModule('users', this.userModule);
  }

  async onApplicationBootstrap() {
    this.logger.log('Application bootstrapping, initializing modules...');
    
    // Initialize modules in dependency order
    await this.userModule.initialize();
    await this.conditioningModule.initialize();
    
    this.logger.log('All modules initialized successfully');
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutting down (signal: ${signal})`);
    
    // Shutdown in reverse dependency order
    await this.conditioningModule.shutdown();
    await this.userModule.shutdown();
    
    this.logger.log('All modules shut down successfully');
  }
}
  */