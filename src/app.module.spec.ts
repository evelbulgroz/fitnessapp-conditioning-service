import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { jest } from '@jest/globals';
import { Subject } from 'rxjs';

import { Logger, MergedStreamLogger, StreamLogger } from "./libraries/stream-loggable";

import AppModule from './app.module';
import AuthService from './authentication/domain/auth-service.class';
import ConditioningLogRepository from './conditioning/repositories/conditioning-log.repo';
import ConditioningController from './conditioning/controllers/conditioning.controller';
import createTestingModule from './test/test-utils';
import EventDispatcherService from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import ModuleStateHealthIndicator from './app-health/health-indicators/module-state-health-indicator';
import RegistrationService from './authentication/services/registration/registration.service';
import RetryHttpService from './shared/services/utils/retry-http/retry-http.service';
import SwaggerController from './api-docs/swagger.controller';
import TokenService from './authentication/services/token/token.service';
import UserController from './user/controllers/user.controller';
import AppDomainStateManager from './app-domain-state-manager';

describe('AppModule', () => {
	let appModule: AppModule;	
	let authService: AuthService;
	let registrationService: RegistrationService;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
				AppModule
			],
			providers: [
				ConfigService,
				// Mocking providers here has no effect, they must be explicitly overridden
			],
		}))
		// Override providers in the real module with mocks (cannot be done in the testing module)
		.overrideProvider(AppDomainStateManager)
		.useValue({
			componentState$: new Subject(),
			initialize: () => Promise.resolve(),
			shutdown: () => Promise.resolve(),
		})
		.overrideProvider(AuthService)
		.useValue({
			getAuthData: jest.fn(),
			logout: jest.fn(),
		})
		.overrideProvider(ConditioningController)
		.useValue({
			// Mock methods as needed					
		})
		.overrideProvider(ConditioningLogRepository)
		.useValue({
			initialize: jest.fn(),
		})
		.overrideProvider(EventDispatcherService)
		.useValue({
			dispatchEvent: jest.fn(),
		})
		.overrideProvider(HttpService)
		.useValue({
			get: jest.fn(),
			post: jest.fn(),
		})
		.overrideProvider(Logger)
		.useValue({
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			verbose: jest.fn(),
			info: jest.fn()
		})
		.overrideProvider(MergedStreamLogger) // Mock the MergedStreamLogger
		.useValue({
			registerMapper: jest.fn(),
			subscribeToStreams: jest.fn(),
			unsubscribeComponent: jest.fn(),
			unsubscribeAll: jest.fn(),
		})
		.overrideProvider(ModuleStateHealthIndicator)
		.useValue({
			isHealthy: jest.fn(),
			mapStateToHealthIndicatorResult: jest.fn(),
		})
		.overrideProvider(RegistrationService)
		.useValue({
			register: jest.fn(),
			deregister: jest.fn(),
		})
		.overrideProvider(RetryHttpService)
		.useValue({
			get: jest.fn(),
			post: jest.fn(),
		})
		.overrideProvider(SwaggerController)
		.useValue({
			// Mock methods as needed					
		})
		.overrideProvider(TokenService)
		.useValue({
		getAuthData: jest.fn(),
			logout: jest.fn(),
		})
		.overrideProvider(UserController)
		.useValue({
			isReady: jest.fn(),
		})
		// Overriding UserRepository triggers a circular dependency error, so we don't override it here
		.compile();

		appModule = module.get<AppModule>(AppModule);
		authService = module.get<AuthService>(AuthService); // bug: returns the real AuthService, not the mock
		registrationService = module.get<RegistrationService>(RegistrationService);
		
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(appModule).toBeDefined();
	});

	describe('Lifecycle Hooks', () => {
		describe('onModuleInit', () => {
			let accessToken: string;
			let registrationSpy: any;
			let testError: string;
			let tokenServiceSpy: any;
			beforeEach(() => {
				accessToken = 'test-access-token';
				registrationSpy = jest.spyOn(registrationService, 'register');//.mockImplementation(() => Promise.resolve(true));
				testError = 'test-error';
				tokenServiceSpy = jest.spyOn(authService, 'getAuthData');//.mockImplementation(() => Promise.resolve(accessToken));
			});

			afterEach(() => {
				registrationSpy && registrationSpy.mockRestore();
				tokenServiceSpy && tokenServiceSpy.mockRestore();
			});

			describe('Authentication', () => {
				it('logs in to the authentication microservice', async () => {
					// arrange
					
					// act
					await appModule.onModuleInit();

					// assert
					expect(tokenServiceSpy).toHaveBeenCalledTimes(1);
				});

				it('logs error and warning if login fails', async () => {
					// arrange
					tokenServiceSpy.mockImplementation(() => Promise.reject(testError));
					const loggerErrorSpy = jest.spyOn(appModule['logger'], 'error')
					const loggerWarnSpy = jest.spyOn(appModule['logger'], 'warn');
					
					// act
					void await appModule.onModuleInit();

					// assert
					expect(tokenServiceSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
					expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledWith("Failed to get access token from auth microservice", testError, "AppModule.onModuleInit");
					expect(loggerWarnSpy).toHaveBeenCalledWith("Continuing startup without authentication.", "AppModule.onModuleInit");

					// clean up
					loggerErrorSpy.mockRestore();
					loggerWarnSpy.mockRestore();
				});

				it('continues startup if login fails', async () => {
					// arrange
					jest.spyOn(authService, 'getAuthData').mockImplementation(() => Promise.reject(testError));
					jest.spyOn(registrationService, 'register').mockClear();
					const registrationSpy = jest.spyOn(registrationService, 'register').mockImplementation(() => Promise.resolve(true));
					
					// act/assert
					expect(async () => await appModule.onModuleInit()).not.toThrow();

					// assert
					expect(registrationSpy).toHaveBeenCalledTimes(1);

					// clean up
					jest.clearAllMocks();
				});
			});

			describe('Registration', () => {
				it('registers with the registry service', async () => {
					// arrange
					
					// act
					await appModule.onModuleInit();

					// assert
					expect(registrationSpy).toHaveBeenCalledTimes(1);
				});

				it('logs error and warning if registration fails', async () => {
					// arrange
					registrationSpy.mockImplementation(() => Promise.reject(testError));
					const loggerErrorSpy = jest.spyOn(appModule['logger'], 'error')
					const loggerWarnSpy = jest.spyOn(appModule['logger'], 'warn');
					
					// act
					void await appModule.onModuleInit();

					// assert
					expect(registrationSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
					expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledWith("Failed to register with microservice registry", testError, "AppModule.onModuleInit");
					expect(loggerWarnSpy).toHaveBeenCalledWith("Continuing startup without registry registration.", "AppModule.onModuleInit");

					// clean up
					loggerErrorSpy.mockRestore();
					loggerWarnSpy.mockRestore();
				});

				it('continues startup if registration fails', async () => {
					// arrange
					registrationSpy.mockImplementation(() => Promise.reject(testError));
					
					// act/assert
					expect(async () => await appModule.onModuleInit()).not.toThrow();
				});
			});
		});

		describe('onModuleDestroy', () => {
			let deregistrationSpy: any;
			let logoutSpy: any;
			let testError: string;
			beforeEach(() => {
				deregistrationSpy = jest.spyOn(registrationService, 'deregister').mockImplementation(() => Promise.resolve(true));
				logoutSpy = jest.spyOn(authService, 'logout').mockImplementation(() => Promise.resolve('Service logout successful'));
				testError = 'test-error';
			});

			afterEach(() => {
				deregistrationSpy && deregistrationSpy.mockRestore();
			});

			describe('Deregistration', () => {		
				it('deregisters from the registry service', async () => {
					// arrange

					// act
					await appModule.onModuleDestroy();

					// assert
					expect(deregistrationSpy).toHaveBeenCalledTimes(1);
				});

				it('logs error and warning if deregistration fails', async () => {
					// arrange
					deregistrationSpy.mockImplementation(() => Promise.reject(testError));
					const loggerErrorSpy = jest.spyOn(appModule['logger'], 'error')
					const loggerWarnSpy = jest.spyOn(appModule['logger'], 'warn');
					
					// act
					void await appModule.onModuleDestroy();

					// assert
					expect(deregistrationSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
					expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledWith("Failed to deregister from microservice registry", testError, "AppModule.onModuleDestroy");
					expect(loggerWarnSpy).toHaveBeenCalledWith("Continuing shutdown without deregistration.", "AppModule.onModuleDestroy");

					// clean up
					loggerErrorSpy.mockRestore();
					loggerWarnSpy.mockRestore();
				});

				it('continues shutdown if deregistration fails', async () => {
					// arrange
					deregistrationSpy.mockImplementation(() => Promise.reject(testError));
					
					// act/assert
					expect(async () => await appModule.onModuleDestroy()).not.toThrow();
				});
			});

			describe('Logout', () => {
				it('logs out of the authentication microservice', async () => {
					// arrange

					// act
					await appModule.onModuleDestroy();

					// assert
					expect(logoutSpy).toHaveBeenCalledTimes(1);
				});

				it('logs error and warning if logout fails', async () => {
					// arrange
					logoutSpy.mockImplementation(() => Promise.reject(testError));
					const loggerErrorSpy = jest.spyOn(appModule['logger'], 'error')
					const loggerWarnSpy = jest.spyOn(appModule['logger'], 'warn');
					
					// act
					void await appModule.onModuleDestroy();

					// assert
					expect(logoutSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
					expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
					expect(loggerErrorSpy).toHaveBeenCalledWith("Failed to log out from auth service", testError, "AppModule.onModuleDestroy");
					expect(loggerWarnSpy).toHaveBeenCalledWith("Continuing shutdown without logout.", "AppModule.onModuleDestroy");

					// clean up
					loggerErrorSpy.mockRestore();
					loggerWarnSpy.mockRestore();
				});

				it('continues shutdown if logout fails', async () => {
					// arrange
					logoutSpy.mockImplementation(() => Promise.reject(testError));
					
					// act/assert
					expect(async () => await appModule.onModuleDestroy()).not.toThrow();
				});
			});
		});
	});

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(appModule.log$).toBeDefined();
				expect(appModule.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(appModule.logger).toBeDefined();
				expect(appModule.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(appModule.logToStream).toBeDefined();
				expect(typeof appModule.logToStream).toBe('function');
			});
		});
	});
});