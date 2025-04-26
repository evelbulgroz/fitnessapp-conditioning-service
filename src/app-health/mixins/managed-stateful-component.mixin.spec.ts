import { take } from 'rxjs';
import { Logger } from '@evelbulgroz/logger';

import { ManagedStatefulComponentMixin } from './managed-stateful-component.mixin';
import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponentOptions from '../models/managed-stateful-component-options.model';

// NOTE: Future test enhancements:
	// - Error Propagation: More detailed tests for error handling scenarios.
	// - Logger Usage: Tests to verify that the logger is used appropriately.
	// - Observable Completion: Tests to verify that observables are completed when components are shut down.
	// - Performance Tests: For measuring the overhead of the mixin.
	// - Integration Tests: With actual components in your application.

// Mock Logger class
jest.mock('@evelbulgroz/logger', () => ({
	Logger: jest.fn().mockImplementation(() => ({
		log: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		info: jest.fn(),
	})),
}));

class MockLogger extends Logger {
	constructor() {
	super();
		this.appName = 'TestApp';
		this.context = 'TestContext';
		this.addLocalTimestamp = true;
		this.logLevel = 'debug';
	}
	public log = jest.fn();
	public error = jest.fn();
	public warn = jest.fn();
	public debug = jest.fn();
	public info = jest.fn();
	public verbose = jest.fn();
}

// Stand-alone component using the mixin
class TestComponent extends ManagedStatefulComponentMixin(class {}) {
	public readonly logger = new MockLogger();
	public initCount = 0;
	public shutdownCount = 0;
	public shouldFailInit = false;
	public shouldFailShutdown = false;
	public initDelay = 0;
	public shutdownDelay = 0;

	public initializeComponent(): Promise<void> {
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

	public shutdownComponent(): Promise<void> {
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

// Base class with its own initialization/shutdown
class BaseWithLifecycle {
	public baseInitCalled = false;
	public baseShutdownCalled = false;

	public async initialize(): Promise<void> {
		this.baseInitCalled = true;
		return Promise.resolve();
	}

	public async shutdown(): Promise<void> {
		this.baseShutdownCalled = true;
		return Promise.resolve();
	}
}

// Component that extends another class
class InheritingComponent extends ManagedStatefulComponentMixin(BaseWithLifecycle) {
	public readonly logger = new MockLogger();

	public async initializeComponent(): Promise<void> {
		// Note: this doesn't call super.initialize() since the mixin shadows it
		// In a real component, you might need to call the base method explicitly
		return Promise.resolve();
	}

	public async shutdownComponent(): Promise<void> {
		return Promise.resolve();
	}
}

// Component that properly calls base methods
class ProperInheritingComponent extends ManagedStatefulComponentMixin(BaseWithLifecycle) {
	public readonly logger = new MockLogger();
	// Access to base class for accessing its methods
	private baseClass: BaseWithLifecycle;

	constructor() {
		super();
		// Create an instance of the base class to call its methods
		this.baseClass = new BaseWithLifecycle();
	}

	public async initializeComponent(): Promise<void> {
		// Explicitly call the base class method via the instance
		await this.baseClass.initialize();
		return Promise.resolve();
	}

	public async shutdownComponent(): Promise<void> {
		// Explicitly call the base class method via the instance
		await this.baseClass.shutdown();
		return Promise.resolve();
	}
}

describe('ManagedStatefulComponentMixin', () => {
	let component: TestComponent;

	beforeEach(() => {
		component = new TestComponent();
		jest.clearAllMocks();
	});

	describe('initial state', () => {
		it('should start in UNINITIALIZED state', () => {
			const state = component.getState();
			expect(state.state).toBe(ComponentState.UNINITIALIZED);
		});

		it('has a state$ Observable', () => {
			expect(component.state$).toBeDefined();
		});
	});

	describe('public API', () => {		
		describe('getState()', () => {
			it('returns the current state', () => {
				const state = component.getState();
				expect(state.state).toBe(ComponentState.UNINITIALIZED);
				expect(state.name).toBe('TestComponent');
				expect(state.reason).toBe('Component created');
				expect(state.updatedOn).toBeInstanceOf(Date);
			});
		});
		
		describe('initialize()', () => {
			it('changes state to INITIALIZING then OK', async () => {
				const stateChanges: ComponentStateInfo[] = [];
				component.state$.subscribe(state => stateChanges.push({ ...state }));

				await component.initialize();

				expect(stateChanges.length).toBe(3); // UNINITIALIZED -> INITIALIZING -> OK
				expect(stateChanges[0].state).toBe(ComponentState.UNINITIALIZED);
				expect(stateChanges[1].state).toBe(ComponentState.INITIALIZING);
				expect(stateChanges[2].state).toBe(ComponentState.OK);
			});

			it('calls initializeComponent exactly once', async () => {
				await component.initialize();
				expect(component.initCount).toBe(1);
			});

			it('resolves immediately if already initialized', async () => {
				await component.initialize();
				component.initCount = 0; // Reset for clarity
				
				await component.initialize();
				expect(component.initCount).toBe(0); // Should not be called again
			});

			it('shares the same promise for concurrent calls', async () => {
				component.initDelay = 50; // Add delay to ensure concurrent calls
				
				const promise1 = component.initialize();
				const promise2 = component.initialize();
				
				await Promise.all([promise1, promise2]);
				
				expect(component.initCount).toBe(1); // Should be called only once
			});

			it('changes state to FAILED if initialization fails', async () => {
				component.shouldFailInit = true;
				
				try {
					await component.initialize();
					fail('has thrown an error');
				} catch (error) {
					const state = component.getState();
					expect(state.state).toBe(ComponentState.FAILED);
					expect(state.reason).toContain('Initialization failed');
				}
			});

			it('resets initializationPromise after completion', async () => {
				await component.initialize();
				expect(component.initializationPromise).toBeUndefined();
			});
			
			it('resets initializationPromise after failure', async () => {
				component.shouldFailInit = true;
				
				try {
					await component.initialize();
				} catch (error) {
					// Expected error
				}
				
				expect(component.initializationPromise).toBeUndefined();
			});
		});

		describe('isReady()', () => {
			it('returns true if component is in OK state', async () => {
				await component.initialize();
				const ready = await component.isReady();
				expect(ready).toBe(true);
			});

			it('returns false if initialization fails', async () => {
				component.shouldFailInit = true;
				const ready = await component.isReady();
				expect(ready).toBe(false);
			});

			it('initializes the component if not initialized', async () => {
				const ready = await component.isReady();
				expect(ready).toBe(true);
				expect(component.initCount).toBe(1);
			});

			it('returns true if component is in DEGRADED state', async () => {
				await component.initialize();
				
				// Manually set state to DEGRADED
				component.stateSubject.next({
					name: component.constructor.name,
					state: ComponentState.DEGRADED,
					reason: 'Service is degraded',
					updatedOn: new Date()
				});
				
				const ready = await component.isReady();
				expect(ready).toBe(true);
			});
		});

		describe('options', () => {
			it('gets the options of the component', () => {
				const options: ManagedStatefulComponentOptions = component.options;
				expect(options).toEqual({
					name: 'TestComponent',
					state: ComponentState.UNINITIALIZED,
					reason: 'Component created',
					updatedOn: expect.any(Date),
				});
			});
			
			xit('sets the options of the component', () => {
				const newOptions: Partial<ManagedStatefulComponentOptions> = {
					initializationStrategy: 'children-first',
					subcomponentStrategy: 'sequential',
				};
				component.options = newOptions;
				const options = component.options;
				expect(options).toEqual(newOptions);
			});
			
			xit('is immutable', () => {
				const originalOptions = component.options;
				const newOptions: Partial<ManagedStatefulComponentOptions> = {
					initializationStrategy: 'children-first',
					subcomponentStrategy: 'sequential',
				};
				component.options = newOptions;
				expect(originalOptions).not.toEqual(newOptions);
				expect(originalOptions).toEqual({
					name: 'TestComponent',
					state: ComponentState.UNINITIALIZED,
					reason: 'Component created',
					updatedOn: expect.any(Date),
				});
			});
		});

		describe('shutdown()', () => {
		it('changes state to SHUTTING_DOWN then SHUT_DOWN', async () => {
			await component.initialize();
			component.shutdownDelay = 250; // Add delay to ensure state changes are observable
			
			const stateChanges: ComponentStateInfo[] = [];
			component.state$.pipe(take(3)).subscribe(state => stateChanges.push({ ...state }));
			
			await component.shutdown();
			
			expect(stateChanges.length).toBe(3); // OK -> SHUTTING_DOWN -> SHUT_DOWN
			expect(stateChanges[0].state).toBe(ComponentState.OK); // BehaviorSubject always immediately emits the current value
			expect(stateChanges[1].state).toBe(ComponentState.SHUTTING_DOWN);
			expect(stateChanges[2].state).toBe(ComponentState.SHUT_DOWN);
		});

		it('calls shutdownComponent exactly once', async () => {
			await component.initialize();
			await component.shutdown();
			expect(component.shutdownCount).toBe(1);
		});

		it('resolves immediately if already shut down', async () => {
			await component.initialize();
			await component.shutdown();
			component.shutdownCount = 0; // Reset for clarity
			
			await component.shutdown();
			expect(component.shutdownCount).toBe(0); // Should not be called again
		});

		it('shares the same promise for concurrent calls', async () => {
			await component.initialize();
			component.shutdownDelay = 50; // Add delay to ensure concurrent calls
			
			const promise1 = component.shutdown();
			const promise2 = component.shutdown();
			
			await Promise.all([promise1, promise2]);
			
			expect(component.shutdownCount).toBe(1); // Should be called only once
		});

		it('changes state to FAILED if shutdown fails', async () => {
			await component.initialize();
			component.shouldFailShutdown = true;
			
			try {
				await component.shutdown();
				fail('has thrown an error');
			} catch (error) {
				const state = component.getState();
				expect(state.state).toBe(ComponentState.FAILED);
				expect(state.reason).toContain('Shutdown failed');
			}
		});

		it('resets shutdownPromise after completion', async () => {
			await component.initialize();
			await component.shutdown();
			expect(component.shutdownPromise).toBeUndefined();
		});
		
		it('resets shutdownPromise after failure', async () => {
			await component.initialize();
			component.shouldFailShutdown = true;
			
			try {
				await component.shutdown();
			} catch (error) {
				// Expected error
			}
			
			expect(component.shutdownPromise).toBeUndefined();
		});
		});
	});
		

	describe('constructor name', () => {
		it('uses the derived class name in state info', () => {
			const state = component.getState();
			expect(state.name).toBe('TestComponent');
		});
	});

	describe('inheritance', () => {
		let inheritingComponent: InheritingComponent;
		let properInheritingComponent: ProperInheritingComponent;

		beforeEach(() => {
			inheritingComponent = new InheritingComponent();
			properInheritingComponent = new ProperInheritingComponent();
		});

		it('shadows base class initialize method', async () => {
			await inheritingComponent.initialize();
			
			expect(inheritingComponent.baseInitCalled).toBe(false);
			expect(inheritingComponent.getState().state).toBe(ComponentState.OK);
		});

		it('shadows base class shutdown method', async () => {
			await inheritingComponent.initialize();
			await inheritingComponent.shutdown();
			
			expect(inheritingComponent.baseShutdownCalled).toBe(false);
			expect(inheritingComponent.getState().state).toBe(ComponentState.SHUT_DOWN);
		});

		it('allows executing base class methods explicitly', async () => {
			await properInheritingComponent.initialize();
			
			// Access baseClass via private property, need to cast to access it in test
			expect((properInheritingComponent as any).baseClass.baseInitCalled).toBe(true);
			expect(properInheritingComponent.getState().state).toBe(ComponentState.OK);
		});

		it('allows executing base class shutdown methods explicitly', async () => {
			await properInheritingComponent.initialize();
			await properInheritingComponent.shutdown();
			
			// Access baseClass via private property, need to cast to access it in test
			expect((properInheritingComponent as any).baseClass.baseShutdownCalled).toBe(true);
			expect(properInheritingComponent.getState().state).toBe(ComponentState.SHUT_DOWN);
		});
	});
});