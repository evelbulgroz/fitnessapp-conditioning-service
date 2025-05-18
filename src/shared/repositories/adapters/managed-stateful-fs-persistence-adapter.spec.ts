import { EntityDTO, EntityMetadataDTO, EntityPersistenceDTO } from '@evelbulgroz/ddd-base';
import * as fs from 'fs';
import { ManagedStatefulFsPersistenceAdapter } from './managed-stateful-fs-persistence-adapter';
import { Observable, firstValueFrom, take } from 'rxjs';
import { ComponentStateInfo, ComponentState } from '../../../libraries/managed-stateful-component';

jest.mock('fs', () => ({
	existsSync: jest.fn().mockReturnValue(true),
	mkdirSync: jest.fn(),
	writeFileSync: jest.fn(),
	readFileSync: jest.fn().mockReturnValue('[]'),
	readdirSync: jest.fn().mockReturnValue([]),
	promises: {
		access: jest.fn().mockResolvedValue(undefined), // Successfully resolves
		mkdir: jest.fn().mockResolvedValue(undefined),
		readdir: jest.fn().mockResolvedValue([]),
		readFile: jest.fn().mockResolvedValue('[]'),
		writeFile: jest.fn().mockResolvedValue(undefined)
	}
}));

// Define a simple type that satisfies the generic constraint
interface TestEntityDTO extends EntityDTO {
	name: string;
}

interface TestMetadataDTO extends EntityMetadataDTO {
	createdBy: string;
}

interface TestPersistenceDTO extends EntityPersistenceDTO<TestEntityDTO, TestMetadataDTO> {
	entityId: string;
	name: string;
	createdBy: string;
	createdOn: string;
	updatedOn: string;
}

describe('ManagedStatefulFsPersistenceAdapter', () => {
	const testStoragePath = './test-storage';
	let adapter: ManagedStatefulFsPersistenceAdapter<TestPersistenceDTO>;

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();
		
		// Create a new instance for each test
		adapter = new ManagedStatefulFsPersistenceAdapter<TestPersistenceDTO>(testStoragePath);
	});

	it('can be instantiated successfully', () => {
		expect(adapter).toBeDefined();
		expect(adapter).toBeInstanceOf(ManagedStatefulFsPersistenceAdapter);
	});

	describe('PersitenceAdapter API', () => {
		it('should inherit all parent methods', () => {
			expect(adapter.create).toBeDefined();
			expect(typeof adapter.create).toBe('function');
			expect(adapter.update).toBeDefined();
			expect(typeof adapter.update).toBe('function');
			expect(adapter.fetchById).toBeDefined();
			expect(typeof adapter.fetchById).toBe('function');
			expect(adapter.fetchAll).toBeDefined();
			expect(typeof adapter.fetchAll).toBe('function');
			expect(adapter.delete).toBeDefined();
			expect(typeof adapter.delete).toBe('function');
			expect(adapter.undelete).toBeDefined();
			expect(typeof adapter.undelete).toBe('function');
			expect(adapter.initialize).toBeDefined();
			expect(typeof adapter.initialize).toBe('function');
			expect(adapter.shutdown).toBeDefined();
			expect(typeof adapter.shutdown).toBe('function');
		});
	});

	describe('Management API', () => {
		// NOTE: no need to fully retest ManagedStatefulComponentMixin methods,
			// as they are already tested in the mixin.
			// Just do a few checks that things are hooked up correctly,
			// and that local implementations work correctly.			
					
		describe('ManagedStatefulComponentMixin Members', () => {
			it('Inherits componentState$ ', () => {
				expect(adapter).toHaveProperty('componentState$');
				expect(adapter.componentState$).toBeDefined();
				expect(adapter.componentState$).toBeInstanceOf(Observable);
			});

			it('Inherits initialize method', () => {
				expect(adapter).toHaveProperty('initialize');
				expect(adapter.initialize).toBeDefined();
				expect(adapter.initialize).toBeInstanceOf(Function);
			});

			it('Inherits shutdown method', () => {
				expect(adapter).toHaveProperty('shutdown');
				expect(adapter.shutdown).toBeDefined();
				expect(adapter.shutdown).toBeInstanceOf(Function);
			});

			it('Inherits isReady method', () => {
				expect(adapter).toHaveProperty('isReady');
				expect(adapter.isReady).toBeDefined();
				expect(adapter.isReady).toBeInstanceOf(Function);
			});

			it('inherits registerSubcomponent method', () => {
				expect(adapter).toHaveProperty('registerSubcomponent');
				expect(adapter.registerSubcomponent).toBeDefined();
				expect(adapter.registerSubcomponent).toBeInstanceOf(Function);
			});

			it('inherits unregisterSubcomponent method', () => {
				expect(adapter).toHaveProperty('unregisterSubcomponent');
				expect(adapter.unregisterSubcomponent).toBeDefined();
				expect(adapter.unregisterSubcomponent).toBeInstanceOf(Function);
			});
		});

		describe('State Transitions', () => {
			it('is in UNINITIALIZED state before initialization', async () => {
				// arrange
				const stateInfo = await firstValueFrom(adapter.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state

				// act
				
				// assert
				expect(stateInfo).toBeDefined();
				expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
			});

			it('is in OK state after initialization', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = adapter.componentState$.subscribe((s) => {
					state = s.state;
				});

				expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check

				// act
				await adapter.initialize();

				// assert
				expect(state).toBe(ComponentState.OK);

				// clean up
				sub.unsubscribe();
			});

			it('is in SHUT_DOWN state after shutdown', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = adapter.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				await adapter.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
				
				// act			
				await adapter.shutdown();

				// assert
				expect(state).toBe(ComponentState.SHUT_DOWN);

				// clean up
				sub.unsubscribe();
			});
		});
		
		describe('initialize', () => {	
			xit('calls onInitialize', async () => {				
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = adapter.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				const onInitializeSpy = jest.spyOn(adapter, 'onInitialize').mockReturnValue(Promise.resolve());
	
				// act
				await adapter.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
	
				// assert
				expect(onInitializeSpy).toHaveBeenCalledTimes(1);
				expect(onInitializeSpy).toHaveBeenCalledWith(expect.objectContaining({ isSuccess: true }));

				// clean up
				sub.unsubscribe();
				onInitializeSpy.mockRestore();
			});
		});

		describe('isReady', () => {		
			it('reports if/when it is initialized (i.e. ready)', async () => {
				// arrange
				await adapter.initialize(); // initialize the adapter

				// act
				const result = await adapter.isReady();

				// assert
				expect(result).toBe(true);
			});
		});		

		describe('shutdown', () => {
			it('calls onShutdown', async () => {				
				// arrange
				const onShutdownSpy = jest.spyOn(adapter, 'onShutdown').mockReturnValue(Promise.resolve());
				await adapter.initialize(); // initialize the adapter
				
				// act
				await adapter.shutdown();
	
				// assert
				expect(onShutdownSpy).toHaveBeenCalledTimes(1);
				expect(onShutdownSpy).toHaveBeenCalledWith(expect.objectContaining({ isSuccess: true }));

				// clean up
				onShutdownSpy.mockRestore();
			});
		});
	});		
});