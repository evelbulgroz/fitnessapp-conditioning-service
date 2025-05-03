import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, Subject, take } from 'rxjs';

import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
//import { Logger } from '@evelbulgroz/logger';
import { ComponentState, ComponentStateInfo, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { StreamLogger } from '../libraries/stream-loggable';

import JwtAuthGuard from '../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import ConditioningController from '../conditioning/controllers/conditioning.controller';
import ConditioningDataService from '../conditioning/services/conditioning-data/conditioning-data.service';
import ConditioningLogCreatedHandler from '../conditioning/handlers/conditioning-log-created.handler';
import ConditioningLogUpdatedHandler from '../conditioning/handlers/conditioning-log-updated.handler';
import ConditioningLogDeletedHandler from '../conditioning/handlers/conditioning-log-deleted.handler';
import ConditioningLogRepository from '../conditioning/repositories/conditioning-log.repo';
import ConditioningModule from './conditioning.module';

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
	let module: ConditioningModule;
	beforeEach(async () => {
		// Create a testing module with mocked dependencies
		testingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({ isGlobal: true }), // Import ConfigModule for ConfigService, required by ConditioningController
				ConditioningModule
			],
		})
		.overrideProvider(ConfigService) // Mock the ConfigService
		.useValue({
			get: jest.fn((key: string) => {
				switch (key) {
				case 'modules.conditioning.repos.fs.dataDir':
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
		.overrideProvider(ConditioningDataService)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			isReady: async () => Promise.resolve(true),
			registerSubcomponent: jest.fn(),
			unregisterSubcomponent: jest.fn(),
			componentState$: new Subject<ComponentStateInfo>(),	
		})
		.overrideProvider(ConditioningLogCreatedHandler)
		.useValue({})
		.overrideProvider(ConditioningLogDeletedHandler)
		.useValue({})
		.overrideProvider(ConditioningLogUpdatedHandler)
		.useValue({})
		.overrideProvider(ConditioningLogRepository)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			isReady: async () => Promise.resolve(true),
			registerSubcomponent: jest.fn(),
			unregisterSubcomponent: jest.fn(),
			componentState$: new Subject<ComponentStateInfo>(),			
		})
		.overrideProvider(ConditioningController)
		.useValue({
			// Basic mock implementation of controller methods
			createUser: jest.fn(),
			deleteUser: jest.fn(),
			undeleteUser: jest.fn(),
		})
		.compile();
	  
		module = testingModule.get<ConditioningModule>(ConditioningModule);
	  });

	afterEach(async () => {
		await testingModule.close();
	});

	it('can be created', () => {
		expect(module).toBeDefined();
		expect(module).toBeInstanceOf(ConditioningModule);
	});

	describe('Lifecycle Hooks', () => {
		describe('onModuleInit', () => {
			it('initializes the module and its subcomponents', async () => {
				// arrange
				const repo = testingModule.get<ConditioningLogRepository<any,any>>(ConditioningLogRepository);
				const service = testingModule.get<ConditioningDataService>(ConditioningDataService);
				const initializeSpy = jest.spyOn(module, 'initialize').mockResolvedValue(void 0);
				const registerSubcomponentSpy = jest.spyOn(module, 'registerSubcomponent').mockReturnValue(true);
	
				// act
				await module.onModuleInit();
	
				// assert
				expect(initializeSpy).toHaveBeenCalledTimes(1);
				expect(registerSubcomponentSpy).toHaveBeenCalledWith(repo);
				expect(registerSubcomponentSpy).toHaveBeenCalledWith(service);
			});
		});

		describe('onModuleDestroy', () => {
			it('shuts down the module and its subcomponents', async () => {
				// arrange
				const repo = testingModule.get<ConditioningLogRepository<any, any>>(ConditioningLogRepository);
				const service = testingModule.get<ConditioningDataService>(ConditioningDataService);
				const shutdownSpy = jest.spyOn(module, 'shutdown').mockResolvedValue(void 0);
				const unregisterSubcomponentSpy = jest.spyOn(module, 'unregisterSubcomponent').mockReturnValue(true);
				
				// act
				await module.onModuleDestroy();
				
				// assert
				expect(shutdownSpy).toHaveBeenCalledTimes(1);
				expect(unregisterSubcomponentSpy).toHaveBeenCalledWith(repo);
				expect(unregisterSubcomponentSpy).toHaveBeenCalledWith(service);
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
			module['msc_zh7y_ownState'] = {
			name: module.constructor.name,
			state: ComponentState.UNINITIALIZED,
			reason: 'Component reset for test',
			updatedOn: new Date()
			};
			
			// Update the state subject with the new state
			module['msc_zh7y_stateSubject'].next({...module['msc_zh7y_ownState']});
			
			// Also reset initialization and shutdown promises
			module['msc_zh7y_initializationPromise'] = undefined;
			module['msc_zh7y_shutdownPromise'] = undefined;
		});	
		
		describe('ManagedStatefulComponentMixin Members', () => {
			it('inherits componentState$ ', () => {
				expect(module).toHaveProperty('componentState$');
				expect(module.componentState$).toBeDefined();
				expect(module.componentState$).toBeInstanceOf(Observable);
			});

			it('inherits initialize method', () => {
				expect(module).toHaveProperty('initialize');
				expect(module.initialize).toBeDefined();
				expect(module.initialize).toBeInstanceOf(Function);
			});

			it('inherits shutdown method', () => {
				expect(module).toHaveProperty('shutdown');
				expect(module.shutdown).toBeDefined();
				expect(module.shutdown).toBeInstanceOf(Function);
			});

			it('inherits isReady method', () => {
				expect(module).toHaveProperty('isReady');
				expect(module.isReady).toBeDefined();
				expect(module.isReady).toBeInstanceOf(Function);
			});

			it('inherits registerSubcomponent method', () => {
				expect(module).toHaveProperty('registerSubcomponent');
				expect(module.registerSubcomponent).toBeDefined();
				expect(module.registerSubcomponent).toBeInstanceOf(Function);
			});

			it('inherits unregisterSubcomponent method', () => {
				expect(module).toHaveProperty('unregisterSubcomponent');
				expect(module.unregisterSubcomponent).toBeDefined();
				expect(module.unregisterSubcomponent).toBeInstanceOf(Function);
			});			
		});

		describe('State Transitions', () => {
			it('is in UNINITIALIZED state before initialization', async () => {
				// arrange
				const stateInfo = await firstValueFrom(module.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state

				// act
				
				// assert
				expect(stateInfo).toBeDefined();
				expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
			});

			it('is in OK state after initialization', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = module.componentState$.subscribe((s) => {
					state = s.state;
				});

				expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check

				// act
				await module.initialize();

				// assert
				expect(state).toBe(ComponentState.OK);

				// clean up
				sub.unsubscribe();
			});

			it('is in SHUT_DOWN state after shutdown', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = module.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				await module.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
				
				// act			
				await module.shutdown();

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
				const sub = module.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				const onInitializeSpy = jest.spyOn(module, 'onInitialize').mockReturnValue(Promise.resolve());
	
				// act
				await module.initialize();
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
				await module.initialize(); // initialize the ConditioningModule

				// act
				const result = await module.isReady();

				// assert
				expect(result).toBe(true);
			});
		});		

		describe('shutdown', () => {
			it('calls onShutdown', async () => {				
				// arrange
				const onShutdownSpy = jest.spyOn(module, 'onShutdown').mockReturnValue(Promise.resolve());
				
				// act
				await module.shutdown();
	
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

				module.registerSubcomponent(subcomponent1);
				module.registerSubcomponent(subcomponent2);
				module.registerSubcomponent(subcomponent3);

				// act
				await module.initialize();

				// assert
				 // note: just verify basic aggregation of state, this is fully tested in the mixin
				const stateInfo = await firstValueFrom(module.componentState$.pipe(take (1))) as ComponentStateInfo;
				expect(stateInfo).toBeDefined();
				expect(stateInfo.state).toBe(ComponentState.OK);
				expect(stateInfo.components).toHaveLength(3);
				expect(stateInfo.components![0].state).toBe(ComponentState.OK);
				expect(stateInfo.components![1].state).toBe(ComponentState.OK);
				expect(stateInfo.components![2].state).toBe(ComponentState.OK);

				// clean up
				module.unregisterSubcomponent(subcomponent1);
				module.unregisterSubcomponent(subcomponent2);
				module.unregisterSubcomponent(subcomponent3);
			});
		});
	});
		
	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(module.log$).toBeDefined();
				expect(module.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(module.logger).toBeDefined();
				expect(module.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(module.logToStream).toBeDefined();
				expect(typeof module.logToStream).toBe('function');
			});
		});
	});
});