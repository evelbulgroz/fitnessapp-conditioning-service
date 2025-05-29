import { Test, TestingModule } from '@nestjs/testing';

import { firstValueFrom, Observable, of, Subject, take } from 'rxjs';
import { ComponentState, ComponentStateInfo, ManagedStatefulComponent, ManagedStatefulComponentMixin, MSC_PREFIX } from '../libraries/managed-stateful-component';
import { MergedStreamLogger, StreamLoggableMixin, StreamLogger } from '../libraries/stream-loggable';

import ConditioningDataService from './services/conditioning-data/conditioning-data.service';
import ConditioningDomainStateManager from './conditioning-domain-state-manager';
import ConditioningLogRepository from './repositories/conditioning-log.repo';

// Mocking the mixins on dependency/subcomponent mocks is too complicated, so taking the easy route
class MockConditioningDataService extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements ManagedStatefulComponent {}
class MockConditioningLogRepository extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements ManagedStatefulComponent {}

describe('ConditioningDomainStateManager', () => {
	let manager: ConditioningDomainStateManager;
	let mockDataService: any;
	let mockRepository: any;
	let mockStreamLogger: any;
	beforeEach(async () => {
		// Create mocks with the required interface
		mockDataService = new MockConditioningDataService();

		mockRepository = new MockConditioningLogRepository();

		mockStreamLogger = {
			subscribeToStreams: jest.fn()
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ConditioningDomainStateManager,
				{
					provide: ConditioningDataService,
					useValue: mockDataService
				},
				{
					provide: ConditioningLogRepository,
					useValue: mockRepository
				},
				{
					provide: MergedStreamLogger,
					useValue: mockStreamLogger
				}
			],
		}).compile();

		manager = module.get<ConditioningDomainStateManager>(ConditioningDomainStateManager);
	});

	it('can be created', () => {
		expect(manager).toBeDefined();
	});

	it('sets __filename property for filePathExtractor', () => {
		expect(manager.__filename).toBeDefined();
		expect(typeof manager.__filename).toBe('string');
	});

	describe('onInitialize', () => {
		it('registers subcomponents', async () => {
			// Spy on the registerSubcomponent method
			const registerSpy = jest.spyOn(manager, 'registerSubcomponent');
			
			await manager.initialize();
			
			expect(registerSpy).toHaveBeenCalledWith(mockRepository);
			expect(registerSpy).toHaveBeenCalledWith(mockDataService);
			expect(registerSpy).toHaveBeenCalledTimes(2);
		});
		
		it('subscribes to log streams', async () => {
			await manager.initialize();
			
			expect(mockStreamLogger.subscribeToStreams).toHaveBeenCalledWith(expect.arrayContaining([
				{ streamType: 'componentState$', component: mockRepository },
				{ streamType: 'componentState$', component: mockDataService },
				{ streamType: 'repoLog$', component: mockRepository },
				{ streamType: 'log$', component: mockDataService },
			]));
		});
	});
	
	
	describe('Management API', () => {
			// NOTE: no need to fully retest ManagedStatefulComponentMixin methods,
			 // as they are already tested in the mixin.
			 // Just do a few checks that things are hooked up correctly,
			 // and that local implementations work correctly.									
				
			beforeEach(async () => {
				// reset the manager before each test
				await manager.shutdown(); // clear subscriptions and cache, and set state to SHUT_DOWN
				manager['msc_zh7y_stateSubject'].next({name: 'ConditioningDataService', state: ComponentState.UNINITIALIZED, updatedOn: new Date()}); // set state to UNINITIALIZED
			});		
			
			describe('ManagedStatefulComponentMixin Members', () => {
				it('inherits componentState$ ', () => {
					expect(manager).toHaveProperty('componentState$');
					expect(manager.componentState$).toBeDefined();
					expect(manager.componentState$).toBeInstanceOf(Observable);
				});
	
				it('inherits initialize method', () => {
					expect(manager).toHaveProperty('initialize');
					expect(manager.initialize).toBeDefined();
					expect(manager.initialize).toBeInstanceOf(Function);
				});
	
				it('inherits shutdown method', () => {
					expect(manager).toHaveProperty('shutdown');
					expect(manager.shutdown).toBeDefined();
					expect(manager.shutdown).toBeInstanceOf(Function);
				});
	
				it('inherits isReady method', () => {
					expect(manager).toHaveProperty('isReady');
					expect(manager.isReady).toBeDefined();
					expect(manager.isReady).toBeInstanceOf(Function);
				});
	
				it('inherits registerSubcomponent method', () => {
					expect(manager).toHaveProperty('registerSubcomponent');
					expect(manager.registerSubcomponent).toBeDefined();
					expect(manager.registerSubcomponent).toBeInstanceOf(Function);
				});
	
				it('inherits unregisterSubcomponent method', () => {
					expect(manager).toHaveProperty('unregisterSubcomponent');
					expect(manager.unregisterSubcomponent).toBeDefined();
					expect(manager.unregisterSubcomponent).toBeInstanceOf(Function);
				});
			});
	
			describe('State Transitions', () => {
				it('is in UNINITIALIZED state before initialization', async () => {
					// arrange
					const stateInfo = await firstValueFrom(manager.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state
	
					// act
					
					// assert
					expect(stateInfo).toBeDefined();
					expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
				});
	
				it('is in OK state after initialization', async () => {
					// arrange
					let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
					const sub = manager.componentState$.subscribe((s) => {
						state = s.state;
					});
	
					expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check
	
					// act
					await manager.initialize();
	
					// assert
					expect(state).toBe(ComponentState.OK);
	
					// clean up
					sub.unsubscribe();
				});
	
				it('is in SHUT_DOWN state after shutdown', async () => {
					// arrange
					let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
					const sub = manager.componentState$.subscribe((s: ComponentStateInfo) => {
						state = s.state;
					});
					expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
					
					await manager.initialize();
					expect(state).toBe(ComponentState.OK); // sanity check
					
					// act			
					await manager.shutdown();
	
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
					const sub = manager.componentState$.subscribe((s: ComponentStateInfo) => {
						state = s.state;
					});
					expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
					
					const onInitializeSpy = jest.spyOn(manager, 'onInitialize').mockReturnValue(Promise.resolve());
		
					// act
					await manager.initialize();
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
					await manager.initialize(); // initialize the manager
	
					// act
					const result = await manager.isReady();
	
					// assert
					expect(result).toBe(true);
				});
			});		
	
			describe('shutdown', () => {
				it('calls onShutdown', async () => {				
					// arrange
					const onShutdownSpy = jest.spyOn(manager, 'onShutdown').mockReturnValue(Promise.resolve());
					
					// act
					await manager.shutdown();
		
					// assert
					expect(onShutdownSpy).toHaveBeenCalledTimes(1);
					expect(onShutdownSpy).toHaveBeenCalledWith(undefined);
	
					// clean up
					onShutdownSpy?.mockRestore();
				});
			});
	});

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(manager.log$).toBeDefined();
				expect(manager.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(manager.logger).toBeDefined();
				expect(manager.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(manager.logToStream).toBeDefined();
				expect(typeof manager.logToStream).toBe('function');
			});
		});
	});
});