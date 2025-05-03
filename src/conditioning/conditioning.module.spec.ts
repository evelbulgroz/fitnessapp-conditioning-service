import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, Subject, take } from 'rxjs';

import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
//import { Logger } from '@evelbulgroz/logger';
import { ComponentState, ComponentStateInfo, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { StreamLogger } from '../libraries/stream-loggable';

import JwtAuthGuard from '../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import { UserModule } from '../user/user.module';
import UserController from '../user/controllers/user.controller';
import UserCreatedHandler from '../user/handlers/user-created.handler';
import UserDeletedHandler from '../user/handlers/user-deleted.handler';
import UserRepository from '../user/repositories/user.repo';
import UserDataService from '../user/services/user-data.service';
import UserUpdatedHandler from '../user/handlers/user-updated.handler';
import { register } from 'module';

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

describe('ConditioningModule', () => {
	let testingModule: TestingModule;
	let userModule: UserModule;
	beforeEach(async () => {
		// Create a testing module with mocked dependencies
		testingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({ isGlobal: true }), // Import ConfigModule for ConfigService, required by UserController
				UserModule
			],
		})
		.overrideProvider(ConfigService) // Mock the ConfigService
		.useValue({
			get: jest.fn((key: string) => {
				switch (key) {
				case 'modules.user.repos.fs.dataDir':
					return 'test-data-dir';
				default:
					return null;
				}
			}),
		})
		.overrideProvider(JwtAuthStrategy) // First, provide the strategy that the guard depends on
		.useValue({
			validate: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
			// Add any other methods needed
		})		
		.overrideGuard(JwtAuthGuard) // Then override the guard that uses the strategy (use overrideGuard)
		.useValue({
			canActivate: jest.fn().mockReturnValue(true),
		})
		.overrideProvider('REPOSITORY_THROTTLETIME')
		.useValue(100)
		.overrideProvider(PersistenceAdapter)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			create: jest.fn(),
			fetchAll: jest.fn(),
			fetchById: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			undelete: jest.fn(),
		})
		.overrideProvider(UserDataService)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			isReady: async () => Promise.resolve(true),
			registerSubcomponent: jest.fn(),
			unregisterSubcomponent: jest.fn(),
			componentState$: new Subject<ComponentStateInfo>(),	
		})
		.overrideProvider(UserCreatedHandler)
		.useValue({})
		.overrideProvider(UserDeletedHandler)
		.useValue({})
		.overrideProvider(UserUpdatedHandler)
		.useValue({})
		.overrideProvider(UserRepository)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			isReady: async () => Promise.resolve(true),
			registerSubcomponent: jest.fn(),
			unregisterSubcomponent: jest.fn(),
			componentState$: new Subject<ComponentStateInfo>(),			
		})
		.overrideProvider(UserController)
		.useValue({
			// Basic mock implementation of controller methods
			createUser: jest.fn(),
			deleteUser: jest.fn(),
			undeleteUser: jest.fn(),
		})
		.compile();
	  
		userModule = testingModule.get<UserModule>(UserModule);
	  });

	afterEach(async () => {
		await testingModule.close();
	});

	it('can be created', () => {
		expect(userModule).toBeDefined();
		expect(userModule).toBeInstanceOf(UserModule);
	});

	describe('Lifecycle Hooks', () => {
		describe('onModuleInit', () => {
			it('initializes the module and its subcomponents', async () => {
				// arrange
				const userRepository = testingModule.get<UserRepository>(UserRepository);
				const userDataService = testingModule.get<UserDataService>(UserDataService);
				const initializeSpy = jest.spyOn(userModule, 'initialize').mockResolvedValue(void 0);
				const registerSubcomponentSpy = jest.spyOn(userModule, 'registerSubcomponent').mockReturnValue(true);
	
				// act
				await userModule.onModuleInit();
	
				// assert
				expect(initializeSpy).toHaveBeenCalledTimes(1);
				expect(registerSubcomponentSpy).toHaveBeenCalledWith(userRepository);
				expect(registerSubcomponentSpy).toHaveBeenCalledWith(userDataService);
			});
		});

		describe('onModuleDestroy', () => {
			it('shuts down the module and its subcomponents', async () => {
				// arrange
				const userRepository = testingModule.get<UserRepository>(UserRepository);
				const userDataService = testingModule.get<UserDataService>(UserDataService);
				const shutdownSpy = jest.spyOn(userModule, 'shutdown').mockResolvedValue(void 0);
				const unregisterSubcomponentSpy = jest.spyOn(userModule, 'unregisterSubcomponent').mockReturnValue(true);
				
				// act
				await userModule.onModuleDestroy();
				
				// assert
				expect(shutdownSpy).toHaveBeenCalledTimes(1);
				expect(unregisterSubcomponentSpy).toHaveBeenCalledWith(userRepository);
				expect(unregisterSubcomponentSpy).toHaveBeenCalledWith(userDataService);
			});
		});
	});	

	describe('Management API', () => {
		// NOTE: no need to fully retest ManagedStatefulComponentMixin methods,
			// as they are already tested in the mixin.
			// Just do a few checks that things are hooked up correctly,
			// and that local implementations work correctly.									
			
		beforeEach(async () => {
			// Reset UserModule to UNINITIALIZED state properly
			userModule['msc_zh7y_ownState'] = {
			name: userModule.constructor.name,
			state: ComponentState.UNINITIALIZED,
			reason: 'Component reset for test',
			updatedOn: new Date()
			};
			
			// Update the state subject with the new state
			userModule['msc_zh7y_stateSubject'].next({...userModule['msc_zh7y_ownState']});
			
			// Also reset initialization and shutdown promises
			userModule['msc_zh7y_initializationPromise'] = undefined;
			userModule['msc_zh7y_shutdownPromise'] = undefined;
		});	
		
		describe('ManagedStatefulComponentMixin Members', () => {
			it('inherits componentState$ ', () => {
				expect(userModule).toHaveProperty('componentState$');
				expect(userModule.componentState$).toBeDefined();
				expect(userModule.componentState$).toBeInstanceOf(Observable);
			});

			it('inherits initialize method', () => {
				expect(userModule).toHaveProperty('initialize');
				expect(userModule.initialize).toBeDefined();
				expect(userModule.initialize).toBeInstanceOf(Function);
			});

			it('inherits shutdown method', () => {
				expect(userModule).toHaveProperty('shutdown');
				expect(userModule.shutdown).toBeDefined();
				expect(userModule.shutdown).toBeInstanceOf(Function);
			});

			it('inherits isReady method', () => {
				expect(userModule).toHaveProperty('isReady');
				expect(userModule.isReady).toBeDefined();
				expect(userModule.isReady).toBeInstanceOf(Function);
			});

			it('inherits registerSubcomponent method', () => {
				expect(userModule).toHaveProperty('registerSubcomponent');
				expect(userModule.registerSubcomponent).toBeDefined();
				expect(userModule.registerSubcomponent).toBeInstanceOf(Function);
			});

			it('inherits unregisterSubcomponent method', () => {
				expect(userModule).toHaveProperty('unregisterSubcomponent');
				expect(userModule.unregisterSubcomponent).toBeDefined();
				expect(userModule.unregisterSubcomponent).toBeInstanceOf(Function);
			});			
		});

		describe('State Transitions', () => {
			it('is in UNINITIALIZED state before initialization', async () => {
				// arrange
				const stateInfo = await firstValueFrom(userModule.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state

				// act
				
				// assert
				expect(stateInfo).toBeDefined();
				expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
			});

			it('is in OK state after initialization', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = userModule.componentState$.subscribe((s) => {
					state = s.state;
				});

				expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check

				// act
				await userModule.initialize();

				// assert
				expect(state).toBe(ComponentState.OK);

				// clean up
				sub.unsubscribe();
			});

			it('is in SHUT_DOWN state after shutdown', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = userModule.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				await userModule.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
				
				// act			
				await userModule.shutdown();

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
				const sub = userModule.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				const onInitializeSpy = jest.spyOn(userModule, 'onInitialize').mockReturnValue(Promise.resolve());
	
				// act
				await userModule.initialize();
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
				await userModule.initialize(); // initialize the userModule

				// act
				const result = await userModule.isReady();

				// assert
				expect(result).toBe(true);
			});
		});		

		describe('shutdown', () => {
			it('calls onShutdown', async () => {				
				// arrange
				const onShutdownSpy = jest.spyOn(userModule, 'onShutdown').mockReturnValue(Promise.resolve());
				
				// act
				await userModule.shutdown();
	
				// assert
				expect(onShutdownSpy).toHaveBeenCalledTimes(1);
				expect(onShutdownSpy).toHaveBeenCalledWith(undefined);

				// clean up
				onShutdownSpy?.mockRestore();
			});
		});

		describe('integration with subcomponents', () => {
			it('gets aggregated state for itself and its registered subcomponents', async () => {
				// arrange
				const subcomponent1 = new TestComponent();
				const subcomponent2 = new TestComponent();
				const subcomponent3 = new TestComponent();

				userModule.registerSubcomponent(subcomponent1);
				userModule.registerSubcomponent(subcomponent2);
				userModule.registerSubcomponent(subcomponent3);

				// act
				await userModule.initialize();

				// assert
				 // note: just verify basic aggregation of state, this is fully tested in the mixin
				const stateInfo = await firstValueFrom(userModule.componentState$.pipe(take (1))) as ComponentStateInfo;
				expect(stateInfo.state).toBe(ComponentState.OK);
				expect(stateInfo.components).toHaveLength(3);
				expect(stateInfo.components![0].state).toBe(ComponentState.OK);
				expect(stateInfo.components![1].state).toBe(ComponentState.OK);
				expect(stateInfo.components![2].state).toBe(ComponentState.OK);

				// clean up
				userModule.unregisterSubcomponent(subcomponent1);
				userModule.unregisterSubcomponent(subcomponent2);
				userModule.unregisterSubcomponent(subcomponent3);
			});
		});
	});
		
	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(userModule.log$).toBeDefined();
				expect(userModule.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(userModule.logger).toBeDefined();
				expect(userModule.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(userModule.logToStream).toBeDefined();
				expect(typeof userModule.logToStream).toBe('function');
			});
		});
	});
});