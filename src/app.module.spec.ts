import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { jest } from '@jest/globals';
import { Observable, firstValueFrom, take, Subject } from 'rxjs';

import { ComponentState, ComponentStateInfo, ManagedStatefulComponentMixin } from './libraries/managed-stateful-component';
import { Logger, StreamLogger } from "./libraries/stream-loggable";
import { MergedStreamLogger } from './libraries/stream-loggable';

import AppModule from './app.module';
import AuthService from './authentication/domain/auth-service.class';
import ConditioningLogRepository from './conditioning/repositories/conditioning-log.repo';
import ConditioningController from './conditioning/controllers/conditioning.controller';
import createTestingModule from './test/test-utils';
import EventDispatcherService from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import RegistrationService from './authentication/services/registration/registration.service';
import RetryHttpService from './shared/services/utils/retry-http/retry-http.service';
import SwaggerController from './api-docs/swagger.controller';
import TokenService from './authentication/services/token/token.service';
import UserController from './user/controllers/user.controller';

// Stand-alone component using the mixin
class TestComponent extends ManagedStatefulComponentMixin(class {}) {
	public initCount = 0;
	public shutdownCount = 0;
	public shouldFailInit = false;
	public shouldFailShutdown = false;
	public initDelay = 0;
	public shutdownDelay = 0;

	public onInitialize(): Promise<void> {
		this.initCount++;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.shouldFailInit) {
					reject(new Error('Initialization failed'));
				} else {
					resolve();
				}
			}, this.initDelay);
		});
	}

	public onShutdown(): Promise<void> {
		this.shutdownCount++;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.shouldFailShutdown) {
					reject(new Error('Shutdown failed'));
				} else {
					resolve();
				}
			}, this.shutdownDelay);
		});
	}
}

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
					tokenServiceSpy.mockImplementation(() => Promise.reject(testError));
					
					// act/assert
					expect(async () => await appModule.onModuleInit()).not.toThrow();

					// assert
					expect(tokenServiceSpy).toHaveBeenCalledTimes(1);
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

	describe('Management API', () => {
			// NOTE: no need to fully retest ManagedStatefulComponentMixin methods,
				// as they are already tested in the mixin.
				// Just do a few checks that things are hooked up correctly,
				// and that local implementations work correctly.									
				
			beforeEach(async () => {
				// Reset ConditioningModule to UNINITIALIZED state properly
				appModule['msc_zh7y_ownState'] = {
					name: appModule.constructor.name,
					state: ComponentState.UNINITIALIZED,
					reason: 'Component reset for test',
					updatedOn: new Date()
				};
				
				// Update the state subject with the new state
				appModule['msc_zh7y_stateSubject'].next({...appModule['msc_zh7y_ownState']});
				
				// Also reset initialization and shutdown promises
				appModule['msc_zh7y_initializationPromise'] = undefined;
				appModule['msc_zh7y_shutdownPromise'] = undefined;
			});	
			
			describe('ManagedStatefulComponentMixin Members', () => {
				it('inherits componentState$ ', () => {
					expect(appModule).toHaveProperty('componentState$');
					expect(appModule.componentState$).toBeDefined();
					expect(appModule.componentState$).toBeInstanceOf(Observable);
				});
	
				it('inherits initialize method', () => {
					expect(appModule).toHaveProperty('initialize');
					expect(appModule.initialize).toBeDefined();
					expect(appModule.initialize).toBeInstanceOf(Function);
				});
	
				it('inherits shutdown method', () => {
					expect(appModule).toHaveProperty('shutdown');
					expect(appModule.shutdown).toBeDefined();
					expect(appModule.shutdown).toBeInstanceOf(Function);
				});
	
				it('inherits isReady method', () => {
					expect(appModule).toHaveProperty('isReady');
					expect(appModule.isReady).toBeDefined();
					expect(appModule.isReady).toBeInstanceOf(Function);
				});
	
				it('inherits registerSubcomponent method', () => {
					expect(appModule).toHaveProperty('registerSubcomponent');
					expect(appModule.registerSubcomponent).toBeDefined();
					expect(appModule.registerSubcomponent).toBeInstanceOf(Function);
				});
	
				it('inherits unregisterSubcomponent method', () => {
					expect(appModule).toHaveProperty('unregisterSubcomponent');
					expect(appModule.unregisterSubcomponent).toBeDefined();
					expect(appModule.unregisterSubcomponent).toBeInstanceOf(Function);
				});			
			});
	
			describe('State Transitions', () => {
				it('is in UNINITIALIZED state before initialization', async () => {
					// arrange
					const stateInfo = await firstValueFrom(appModule.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state
	
					// act
					
					// assert
					expect(stateInfo).toBeDefined();
					expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
				});
	
				it('is in OK state after initialization', async () => {
					// arrange
					let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
					const sub = appModule.componentState$.subscribe((s) => {
						state = s.state;
					});
	
					expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check
	
					// act
					await appModule.initialize();
	
					// assert
					expect(state).toBe(ComponentState.OK);
	
					// clean up
					sub.unsubscribe();
				});
	
				it('is in SHUT_DOWN state after shutdown', async () => {
					// arrange
					let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
					const sub = appModule.componentState$.subscribe((s: ComponentStateInfo) => {
						state = s.state;
					});
					expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
					
					await appModule.initialize();
					expect(state).toBe(ComponentState.OK); // sanity check
					
					// act			
					await appModule.shutdown();
	
					// assert
					expect(state).toBe(ComponentState.SHUT_DOWN);
	
					// clean up
					sub.unsubscribe();
				});
			});
			
			describe('initialize', () => {	
				it('calls onInitialize', async () => {				
					// arrange
					let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
					const sub = appModule.componentState$.subscribe((s: ComponentStateInfo) => {
						state = s.state;
					});
					expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
					
					const onInitializeSpy = jest.spyOn(appModule, 'onInitialize').mockReturnValue(Promise.resolve());
		
					// act
					await appModule.initialize();
					expect(state).toBe(ComponentState.OK); // sanity check
		
					// assert
					expect(onInitializeSpy).toHaveBeenCalledTimes(1);
					expect(onInitializeSpy).toHaveBeenCalledWith(undefined);
	
					// clean up
					sub.unsubscribe();
					onInitializeSpy?.mockRestore();
				});
			});
	
			describe('isReady', () => {		
				it('reports if/when it is initialized (i.e. ready)', async () => {
					// arrange
					await appModule.initialize(); // initialize the ConditioningModule
	
					// act
					const result = await appModule.isReady();
	
					// assert
					expect(result).toBe(true);
				});
			});		
	
			describe('shutdown', () => {
				it('calls onShutdown', async () => {				
					// arrange
					const onShutdownSpy = jest.spyOn(appModule, 'onShutdown').mockReturnValue(Promise.resolve());
					
					// act
					await appModule.shutdown();
		
					// assert
					expect(onShutdownSpy).toHaveBeenCalledTimes(1);
					expect(onShutdownSpy).toHaveBeenCalledWith(undefined);
	
					// clean up
					onShutdownSpy?.mockRestore();
				});
			});
	
			describe('Integration with Subcomponents', () => {
				it('gets aggregated state for itself and its registered subcomponents', async () => {
					// arrange
					const subcomponent1 = new TestComponent();
					const subcomponent2 = new TestComponent();
					const subcomponent3 = new TestComponent();
	
					appModule.registerSubcomponent(subcomponent1);
					appModule.registerSubcomponent(subcomponent2);
					appModule.registerSubcomponent(subcomponent3);
	
					// act
					await appModule.initialize();
	
					// assert
					 // note: just verify basic aggregation of state, this is fully tested in the mixin
					const stateInfo = await firstValueFrom(appModule.componentState$.pipe(take (1))) as ComponentStateInfo;
					expect(stateInfo).toBeDefined();
					expect(stateInfo.state).toBe(ComponentState.OK);
					expect(stateInfo.components).toHaveLength(3);
					expect(stateInfo.components![0].state).toBe(ComponentState.OK);
					expect(stateInfo.components![1].state).toBe(ComponentState.OK);
					expect(stateInfo.components![2].state).toBe(ComponentState.OK);
	
					// clean up
					appModule.unregisterSubcomponent(subcomponent1);
					appModule.unregisterSubcomponent(subcomponent2);
					appModule.unregisterSubcomponent(subcomponent3);
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