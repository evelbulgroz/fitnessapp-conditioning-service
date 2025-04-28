import { take } from 'rxjs';

import ManagedStatefulComponentMixin from './managed-stateful-component.mixin';
import ComponentState from '../models/component-state.enum';
import ComponentStateInfo from '../models/component-state-info.model';

// NOTE: Future test enhancements:
	// - Error Propagation: More detailed tests for error handling scenarios.
	// - Observable Completion: Tests to verify that observables are completed when components are shut down.
	// - Performance Tests: For measuring the overhead of the mixin.
	// - Integration Tests: With actual components in the application.

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

describe('ManagedStatefulComponentMixin', () => {
	let component: TestComponent;
	let unshadowPrefix: string;
	beforeEach(() => {
		component = new TestComponent();
		unshadowPrefix = component['msc_zh7y_unshadowPrefix'];
		jest.clearAllMocks();
	});

	it('can be created as an instance retaining its inheritance from the base class', () => {
		expect(component).toBeDefined();
		expect(component).toBeInstanceOf(TestComponent);
	});
	
	it('should start in UNINITIALIZED state', () => {
		const state = component[`${unshadowPrefix}calculateState`]();
		expect(state.state).toBe(ComponentState.UNINITIALIZED);
	});

	describe('public API', () => {	
		describe('constructor', () => {
			it('applies default options when none are provided', () => {
				const component = new TestComponent();
				
				expect(component.msc_zh7y_options).toEqual({
					initializationStrategy: 'parent-first',
					shutDownStrategy: 'parent-first',
					subcomponentStrategy: 'parallel'
				});
			});
			
			it('applies custom options when provided', () => {
				// Create a class that uses the mixin with custom options
				class CustomOptionsComponent extends ManagedStatefulComponentMixin(class {}, {
					initializationStrategy: 'children-first',
					shutDownStrategy: 'children-first',
					subcomponentStrategy: 'sequential'
				}) {}
				
				const component = new CustomOptionsComponent();
				
				expect(component.msc_zh7y_options).toEqual({
					initializationStrategy: 'children-first',
					shutDownStrategy: 'children-first',
					subcomponentStrategy: 'sequential'
				});
			});
			
			it('applies a custom prefix when provided', () => {
				// Create a class that uses the mixin with a custom prefix
				class CustomPrefixComponent extends ManagedStatefulComponentMixin(class {}, undefined, 'custom_prefix_') {}
				
				const component = new CustomPrefixComponent();
				
				expect(component.msc_zh7y_unshadowPrefix).toBe('custom_prefix_');
			});
			
			it('maintains inheritance from parent class properties', () => {
				// Create a parent class with properties
				class ParentWithProperties {
					public parentProperty = 'parent value';
					public parentMethod() {
					return 'parent method called';
					}
				}
				
				// Create a class that extends the parent with the mixin
				class InheritingComponent extends ManagedStatefulComponentMixin(ParentWithProperties) {}
				
				const component = new InheritingComponent();
				
				// Verify parent properties are accessible
				expect(component.parentProperty).toBe('parent value');
				expect(component.parentMethod()).toBe('parent method called');
			});
				
			it('maintains inheritance from parent class constructor arguments', () => {
				// Create a parent class that accepts constructor arguments
				class ParentWithConstructor {
					public constructorArg: string;
					
					constructor(arg: string) {
					this.constructorArg = arg;
					}
				}
				
				// Create a class that extends the parent with the mixin
				class InheritingComponent extends ManagedStatefulComponentMixin(ParentWithConstructor) {}
				
				const component = new InheritingComponent('test argument');
				
				// Verify constructor arguments are passed to parent
				expect(component.constructorArg).toBe('test argument');
			});
			
			it('allows overriding parent class methods', () => {
				// Create a parent class with a method
				class ParentWithMethod {
					public testMethod() {
					return 'parent method';
					}
				}
				
				// Create a class that extends the parent with the mixin and overrides the method
				class OverridingComponent extends ManagedStatefulComponentMixin(ParentWithMethod) {
					public testMethod() {
					return 'overridden method';
					}
				}
				
				const component = new OverridingComponent();
				
				// Verify method is properly overridden
				expect(component.testMethod()).toBe('overridden method');
			});
			
			it('allows super calls to parent class methods', () => {
				// Create a parent class with a method
				class ParentWithMethod {
					public testMethod() {
					return 'parent method';
					}
				}
				
				// Create a class that extends the parent with the mixin and calls super
				class SuperCallingComponent extends ManagedStatefulComponentMixin(ParentWithMethod) {
					public testMethod() {
					return `extended ${super.testMethod()}`;
					}
				}
				
				const component = new SuperCallingComponent();
				
				// Verify super call works correctly
				expect(component.testMethod()).toBe('extended parent method');
			});
		});

		describe('componentState$', () => { // TODO: Breaks other tests, investigate
			it('emits the current state', (done) => {
				const sub = component.componentState$.subscribe(state => {
					expect(state.state).toBe(ComponentState.UNINITIALIZED);
					expect(state.name).toBe('TestComponent');
					expect(state.reason).toBe('Component created');
					expect(state.updatedOn).toBeInstanceOf(Date);					
					done();
				});
				sub.unsubscribe();
			});

			it('emits state changes', async () => {
				const stateChanges: ComponentStateInfo[] = [];
				const sub = component.componentState$.subscribe(state => stateChanges.push({ ...state }));
				await new Promise(resolve => setTimeout(resolve, 100)); // Add some time before updating state, so we can detect the difference
				
				component[`${unshadowPrefix}updateState`]({ state: ComponentState.OK, reason: 'Test reason' });
				
				expect(stateChanges.length).toBe(2); // UNINITIALIZED -> OK
				expect(stateChanges[0].state).toBe(ComponentState.UNINITIALIZED);
				expect(stateChanges[1].state).toBe(ComponentState.OK);
				expect(stateChanges[1].reason).toBe('Test reason');
				expect(stateChanges[1].updatedOn).toBeInstanceOf(Date);
				expect(stateChanges[1].name).toBe('TestComponent');
				expect(stateChanges[0].updatedOn).not.toEqual(stateChanges[1].updatedOn); // UpdatedOn should be different
				expect(stateChanges[0].updatedOn.getTime()).toBeLessThan(stateChanges[1].updatedOn.getTime()); // UNINITIALIZED should be before OK
				sub.unsubscribe();				
			});
		});
		
		describe('initialize', () => {
			it('changes state to INITIALIZING then OK', async () => {
				const stateChanges: ComponentStateInfo[] = [];
				const sub = component.componentState$.subscribe(state => stateChanges.push({ ...state }));

				await component.initialize();

				expect(stateChanges.length).toBe(3); // UNINITIALIZED -> INITIALIZING -> OK
				expect(stateChanges[0].state).toBe(ComponentState.UNINITIALIZED);
				expect(stateChanges[1].state).toBe(ComponentState.INITIALIZING);
				expect(stateChanges[2].state).toBe(ComponentState.OK);

				sub.unsubscribe();
			});

			it('calls onInitialize exactly once', async () => {
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
					const state = component[`${unshadowPrefix}calculateState`]();
					expect(state.state).toBe(ComponentState.FAILED);
					expect(state.reason).toContain('Initialization failed');
				}
			});

			it('resets initializationPromise after completion', async () => {
				await component.initialize();
				expect(component.msc_zh7y_initializationPromise).toBeUndefined();
			});
			
			it('resets initializationPromise after failure', async () => {
				component.shouldFailInit = true;
				
				try {
					await component.initialize();
				} catch (error) {
					// Expected error
				}
				
				expect(component.msc_zh7y_initializationPromise).toBeUndefined();
			});
		});

		describe('isReady', () => {
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
				component. msc_zh7y_stateSubject.next({
					name: component.constructor.name,
					state: ComponentState.DEGRADED,
					reason: 'Service is degraded',
					updatedOn: new Date()
				});
				
				const ready = await component.isReady();
				expect(ready).toBe(true);
			});
		});

		describe('shutdown', () => {
			it('changes state to SHUTTING_DOWN then SHUT_DOWN', async () => {
				await component.initialize();
				component.shutdownDelay = 250; // Add delay to ensure state changes are observable
				
				const stateChanges: ComponentStateInfo[] = [];
				const sub = component.componentState$.pipe(take(3)).subscribe(state => stateChanges.push({ ...state }));
				
				await component.shutdown();
				
				expect(stateChanges.length).toBe(3); // OK -> SHUTTING_DOWN -> SHUT_DOWN
				expect(stateChanges[0].state).toBe(ComponentState.OK); // BehaviorSubject always immediately emits the current value
				expect(stateChanges[1].state).toBe(ComponentState.SHUTTING_DOWN);
				expect(stateChanges[2].state).toBe(ComponentState.SHUT_DOWN);

				sub.unsubscribe();
			});

			it('calls onShutdown exactly once', async () => {
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
					const state = component[`${unshadowPrefix}calculateState`]();
					expect(state.state).toBe(ComponentState.FAILED);
					expect(state.reason).toContain('Shutdown failed');
				}
			});

			it('resets shutdownPromise after completion', async () => {
				await component.initialize();
				await component.shutdown();
				expect(component.msc_zh7y_shutdownPromise).toBeUndefined();
			});
			
			it('resets shutdownPromise after failure', async () => {
				await component.initialize();
				component.shouldFailShutdown = true;
				
				try {
					await component.shutdown();
				} catch (error) {
					// Expected error
				}
				
				expect(component.msc_zh7y_shutdownPromise).toBeUndefined();
			});
		});
		
		describe('registerSubcomponent', () => {
			it('adds a subcomponent to the list', () => {
				const subcomponent = new TestComponent();
				component.registerSubcomponent(subcomponent);
				expect(component. msc_zh7y_subcomponents).toContain(subcomponent);
			});

			it('does not allow null or undefined subcomponents', () => {
				expect(() => component.registerSubcomponent(null as any)).toThrow(); // Null
				expect(() => component.registerSubcomponent(undefined as any)).toThrow(); // Undefined
			});

			it('does not allow non-component subcomponents', () => {
				expect(() => component.registerSubcomponent({} as any)).toThrow(); // Non-component
			});

			it('does not allow duplicate subcomponents', () => {
				const subcomponent = new TestComponent();
				component.registerSubcomponent(subcomponent);
				expect(() => component.registerSubcomponent(subcomponent)).toThrow(); // Register again
				expect(component. msc_zh7y_subcomponents.length).toBe(1); // Should still be only one
			});

			// todo: test subscription to subcomponent state changes when deciding to keep updateAggregatedState() or not
		});
		
		describe('unregisterSubcomponent', () => {
			it('removes a subcomponent from the list', () => {
				const subcomponent = new TestComponent();
				component.registerSubcomponent(subcomponent);
				component.unregisterSubcomponent(subcomponent);
				expect(component. msc_zh7y_subcomponents).not.toContain(subcomponent);
			});

			it('does nothing if the subcomponent is not registered', () => {
				const subcomponent = new TestComponent();
				component.unregisterSubcomponent(subcomponent); // Not registered
				expect(component. msc_zh7y_subcomponents.length).toBe(0); // Should still be empty
			});

			// todo: test subscription to subcomponent state changes when deciding to keep updateAggregatedState() or not
		});		
	});

	describe('Protected methods', () => {
		describe('calculateState', () => {
			it(`returns component's own state if no subcomponents are registered`, () => {
				const state = component[`${unshadowPrefix}calculateState`]();
				expect(state.state).toBe(ComponentState.UNINITIALIZED);
				expect(state.name).toBe('TestComponent');
				expect(state.reason).toBe('Component created');
				expect(state.updatedOn).toBeInstanceOf(Date);
			});

			it(`returns aggregated state if subcomponents are registered`, async () => {
				const subcomponent1 = new TestComponent();
				component.registerSubcomponent(subcomponent1);
				subcomponent1. msc_zh7y_stateSubject.next({
					name: 'Subcomponent1',
					state: ComponentState.OK,
					reason: 'All good',
					updatedOn: new Date()
				});

				const subComponent2 = new TestComponent();
				component.registerSubcomponent(subComponent2);
				subComponent2. msc_zh7y_stateSubject.next({
					name: 'Subcomponent2',
					state: ComponentState.DEGRADED,
					reason: 'Minor issue',
					updatedOn: new Date()
				});
				
				await component.initialize();
				expect(component['msc_zh7y_ownState'].state).toBe(ComponentState.OK);
				const aggregatedState = component[`${unshadowPrefix}calculateState`]();
				expect(aggregatedState.state).toBe(ComponentState.DEGRADED);
				expect(aggregatedState.name).toBe('TestComponent');
				expect(aggregatedState.reason).toContain('Aggregated state [OK: 2/3, DEGRADED: 1/3]');
			});
		});

		describe('calculateWorstState', () => {
			it('returns the worst state from the list of states', () => {
				const states: ComponentStateInfo[] = [
					{state: ComponentState.OK, name: 'Component1', updatedOn: new Date()},
					{state: ComponentState.DEGRADED, name: 'Component2', updatedOn: new Date()},
					{state: ComponentState.FAILED, name: 'Component3', updatedOn: new Date()},
					{state: ComponentState.UNINITIALIZED, name: 'Component4', updatedOn: new Date()}
				];
				const worstState = component[`${unshadowPrefix}calculateWorstState`](states);
				expect(worstState.state).toBe(ComponentState.FAILED);
			});

			it('returns the best state if all states are the same', () => {
				const states: ComponentStateInfo[] = [
					{state: ComponentState.OK, name: 'Component1', updatedOn: new Date()},
					{state: ComponentState.OK, name: 'Component2', updatedOn: new Date()},
					{state: ComponentState.OK, name: 'Component3', updatedOn: new Date()}
				];
				const worstState = component[`${unshadowPrefix}calculateWorstState`](states);
				expect(worstState.state).toBe(ComponentState.OK);
			});

			it('returns the worst state if only one state is provided', () => {
				const states: ComponentStateInfo[] = [
					{state: ComponentState.OK, name: 'Component1', updatedOn: new Date()}
				];
				const worstState = component[`${unshadowPrefix}calculateWorstState`](states);
				expect(worstState.state).toBe(ComponentState.OK);
			});		
			
			it('logs a warning and falls back to DEGRADED all states are unknown', () => {
				const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // suppress console output
				const states: ComponentStateInfo[] = [
					{state: 'UNKNOWN' as any, name: 'Component1', updatedOn: new Date()},
					{state: 'UNKNOWN' as any, name: 'Component2', updatedOn: new Date()}
				];
				
				const worstState = component[`${unshadowPrefix}calculateWorstState`](states);
				
				expect(warnSpy).toHaveBeenCalledWith('Failed to determine component state, falling back to DEGRADED state', 'TestComponent.calculateWorstState()');
				expect(worstState.state).toBe(ComponentState.DEGRADED);				
			});

			it('logs a warning and falls back to worst state if some but not all states are unknown', () => {
				const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // suppress console output
				const states: ComponentStateInfo[] = [
					{state: ComponentState.OK, name: 'Component1', updatedOn: new Date()},
					{state: 'UNKNOWN' as any, name: 'Component2', updatedOn: new Date()}
				];
				const worstState = component[`${unshadowPrefix}calculateWorstState`](states);
				expect(warnSpy).toHaveBeenCalledWith('Unknown states were encountered during state calculation, returning worst state, or DEGRADED if worse', 'TestComponent.calculateWorstState()');
				expect(worstState.state).toBe(ComponentState.DEGRADED);
			});

			it('throws an error if no states are provided', () => {
				expect(() => component[`${unshadowPrefix}calculateWorstState`]([])).toThrow('Cannot calculate worst state from an empty array');
			});
		});

		describe('createAggregatedReason', () => {
			it('creates a human-readable reason string with components in multiple states', () => {
				// Arrange
				const states: ComponentStateInfo[] = [
				{
					state: ComponentState.OK,
					name: 'Component1',
					reason: 'Running normally',
					updatedOn: new Date()
				},
				{
					state: ComponentState.DEGRADED,
					name: 'Component2',
					reason: 'Performance issues',
					updatedOn: new Date()
				},
				{
					state: ComponentState.FAILED,
					name: 'Component3',
					reason: 'Connection error',
					updatedOn: new Date()
				}
				];
				
				const worstState = states[2]; // FAILED component
				
				// Act
				const reason = component[`${unshadowPrefix}createAggregatedReason`](states, worstState);
				
				// Assert
				expect(reason).toContain('Aggregated state [');
				expect(reason).toContain('OK: 1/3');
				expect(reason).toContain('DEGRADED: 1/3');
				expect(reason).toContain('FAILED: 1/3');
				expect(reason).toContain('Worst: Component3 - Connection error');
			});
			
			it('creates a reason string when all components are in the same state', () => {
				// Arrange
				const states: ComponentStateInfo[] = [
				{
					state: ComponentState.OK,
					name: 'Component1',
					reason: 'Running normally',
					updatedOn: new Date()
				},
				{
					state: ComponentState.OK,
					name: 'Component2',
					reason: 'Running normally',
					updatedOn: new Date()
				},
				{
					state: ComponentState.OK,
					name: 'Component3',
					reason: 'Running normally',
					updatedOn: new Date()
				}
				];
				
				const worstState = states[0]; // OK component
				
				// Act
				const reason = component[`${unshadowPrefix}createAggregatedReason`](states, worstState);
				
				// Assert
				expect(reason).toContain('Aggregated state [OK: 3/3]');
				expect(reason).toContain('Worst: Component1 - Running normally');
			});
			
			it('handles a single component state', () => {
				// Arrange
				const states: ComponentStateInfo[] = [
				{
					state: ComponentState.INITIALIZING,
					name: 'Component1',
					reason: 'Starting up',
					updatedOn: new Date()
				}
				];
				
				const worstState = states[0]; // INITIALIZING component
				
				// Act
				const reason = component[`${unshadowPrefix}createAggregatedReason`](states, worstState);
				
				// Assert
				expect(reason).toContain('Aggregated state [INITIALIZING: 1/1]');
				expect(reason).toContain('Worst: Component1 - Starting up');
			});
			
			it('includes unknown states in the count', () => {
				// Arrange
				const states: ComponentStateInfo[] = [
				{
					state: ComponentState.OK,
					name: 'Component1',
					reason: 'Running normally',
					updatedOn: new Date()
				},
				{
					state: 'UNKNOWN_STATE' as any,
					name: 'Component2',
					reason: 'Custom state',
					updatedOn: new Date()
				}
				];
				
				const worstState = states[0]; // OK component (assuming calculateWorstState filtered unknown)
				
				// Act
				const reason = component[`${unshadowPrefix}createAggregatedReason`](states, worstState);
				
				// Assert
				expect(reason).toContain('Aggregated state [');
				expect(reason).toContain('OK: 1/2');
				expect(reason).toContain('UNKNOWN_STATE: 1/2');
				expect(reason).toContain('Worst: Component1 - Running normally');
			});
			
			it('handles components with missing reason fields', () => {
				// Arrange
				const states: ComponentStateInfo[] = [
				{
					state: ComponentState.OK,
					name: 'Component1',
					updatedOn: new Date()
				} as ComponentStateInfo,
				{
					state: ComponentState.DEGRADED,
					name: 'Component2',
					reason: 'Performance issues',
					updatedOn: new Date()
				}
				];
				
				const worstState = states[1]; // DEGRADED component
				
				// Act
				const reason = component[`${unshadowPrefix}createAggregatedReason`](states, worstState);
				
				// Assert
				expect(reason).toContain('Aggregated state [');
				expect(reason).toContain('OK: 1/2');
				expect(reason).toContain('DEGRADED: 1/2');
				expect(reason).toContain('Worst: Component2 - Performance issues');
			});
			
			it('handles worstState with missing fields gracefully', () => {
				// Arrange
				const states: ComponentStateInfo[] = [
				{
					state: ComponentState.OK,
					name: 'Component1',
					reason: 'Running normally',
					updatedOn: new Date()
				},
				{
					state: ComponentState.FAILED,
					name: 'Component2',
					updatedOn: new Date()
				} as ComponentStateInfo
				];
				
				const worstState = states[1]; // FAILED component with missing reason
				
				// Act
				const reason = component[`${unshadowPrefix}createAggregatedReason`](states, worstState);
				
				// Assert
				expect(reason).toContain('Aggregated state [');
				expect(reason).toContain('OK: 1/2');
				expect(reason).toContain('FAILED: 1/2');
				expect(reason).toContain('Worst: Component2');
				expect(reason).not.toContain('undefined');
			});
		});

		describe('onInitialize', () => {
			it('is called during initialization', async () => {
				await component.initialize();
				expect(component.initCount).toBe(1);
			});

			it('is not called if already initialized', async () => {
				await component.initialize();
				component.initCount = 0; // Reset for clarity
				
				await component.initialize();
				expect(component.initCount).toBe(0); // Should not be called again
			});

			it('by default returns a resolved promise', async () => {
				const result = await component.onInitialize();
				expect(result).toBeUndefined();
			});
			
			it('can be overridden to provide custom initialization logic', async () => {
				component.initDelay = 100; // Simulate a delay
				const startTime = Date.now();
				await component.onInitialize();
				const endTime = Date.now();
				expect(endTime - startTime).toBeGreaterThanOrEqual(100); // Should take at least 100ms

				expect(component.initCount).toBe(1); // Should be called once
				expect(component.shutdownCount).toBe(0); // Should not be called

				// Reset for clarity
				component.initCount = 0;
				component.shutdownCount = 0;
			});

			it('receives the result from super.onInitialize()', async () => {
				// Create a parent class with initialize that returns a value
				class ParentWithInitialize {
				  public async initialize(): Promise<any> {
					return Promise.resolve('parent initialized');
				  }
				}
				
				// Create a class that extends the parent with the mixin
				class InheritingComponent extends ManagedStatefulComponentMixin(ParentWithInitialize) {
				  public initValue: string | undefined;
				  
					public async onInitialize(superReturn: any): Promise<void> {
						this.initValue = superReturn; // Store the value returned from super.onInitialize()
					}
				}
				
				const component = new InheritingComponent();
				await component.initialize();
				
				// Verify super.initialize() result was passed to child
				expect(component.initValue).toBe('parent initialized');
			});
		});

		describe('onShutdown', () => {
			it('is called during shutdown', async () => {
				await component.initialize();
				await component.shutdown();
				expect(component.shutdownCount).toBe(1);
			});

			it('is not called if already shut down', async () => {
				await component.initialize();
				await component.shutdown();
				component.shutdownCount = 0; // Reset for clarity
				
				await component.shutdown();
				expect(component.shutdownCount).toBe(0); // Should not be called again
			});

			it('by default returns a resolved promise', async () => {
				const result = await component.onShutdown();
				expect(result).toBeUndefined();
			});
			
			it('can be overridden to provide custom shutdown logic', async () => {
				component.shutdownDelay = 100; // Simulate a delay
				const startTime = Date.now();
				await component.onShutdown();
				const endTime = Date.now();
				expect(endTime - startTime).toBeGreaterThanOrEqual(100); // Should take at least 100ms

				expect(component.shutdownCount).toBe(1); // Should be called once
				expect(component.initCount).toBe(0); // Should not be called

				// Reset for clarity
				component.initCount = 0;
				component.shutdownCount = 0;
			});

			it('receives the result from super.onShutdown()', async () => {
				// Create a parent class with shutdown that returns a value
				class ParentWithInitialize {
				  public async shutdown(): Promise<any> {
					return Promise.resolve('parent shut down');
				  }
				}
				
				// Create a class that extends the parent with the mixin
				class InheritingComponent extends ManagedStatefulComponentMixin(ParentWithInitialize) {
				  public shutdownValue: string | undefined;
				  
					public async onShutdown(superReturn: any): Promise<void> {
						this.shutdownValue = superReturn; // Store the value returned from super.onInitialize()
					}
				}
				
				const component = new InheritingComponent();
				await component.shutdown();
				
				// Verify super.shutdown() result was passed to child
				expect(component.shutdownValue).toBe('parent shut down');
			});
		});

		describe('updateAggregatedState', () => {
			it('updates the aggregated state based on subcomponents', async () => {
				const subcomponent1 = new TestComponent();
				const subcomponent2 = new TestComponent();
				component.registerSubcomponent(subcomponent1);
				component.registerSubcomponent(subcomponent2);

				subcomponent1. msc_zh7y_stateSubject.next({
					name: 'Subcomponent1',
					state: ComponentState.OK,
					reason: 'All good',
					updatedOn: new Date()
				});
				subcomponent2. msc_zh7y_stateSubject.next({
					name: 'Subcomponent2',
					state: ComponentState.DEGRADED,
					reason: 'Minor issue',
					updatedOn: new Date()
				});

				await component.initialize();
				expect(component['msc_zh7y_ownState'].state).toBe(ComponentState.OK);

				component[`${unshadowPrefix}updateAggregatedState`]();

				const state = component[`${unshadowPrefix}calculateState`]();
				expect(state.state).toBe(ComponentState.DEGRADED);
			});

			it('does not update the aggregated state if no subcomponents are registered', () => {
				component[`${unshadowPrefix}updateAggregatedState`]();
				const state = component[`${unshadowPrefix}calculateState`]();
				expect(state.state).toBe(ComponentState.UNINITIALIZED);
			});
		});

		describe('updateState', () => {
			it('updates the state and emits the new state', async () => {
				const stateChanges: ComponentStateInfo[] = [];
				const sub = component.componentState$.subscribe(state => stateChanges.push({ ...state }));

				await new Promise(resolve => setTimeout(resolve, 100)); // Add some time before updating state, so we can detect the difference
				component[`${unshadowPrefix}updateState`]({state: ComponentState.OK, reason: 'Test reason'});

				expect(stateChanges.length).toBe(2); // UNINITIALIZED -> OK
				
				expect(stateChanges[0].state).toBe(ComponentState.UNINITIALIZED);
				expect(stateChanges[0].reason).toBe('Component created');
				expect(stateChanges[0].updatedOn).toBeInstanceOf(Date);
				expect(stateChanges[0].name).toBe('TestComponent');
				
				expect(stateChanges[1].state).toBe(ComponentState.OK);
				expect(stateChanges[1].reason).toBe('Test reason');
				expect(stateChanges[1].updatedOn).toBeInstanceOf(Date);
				expect(stateChanges[1].name).toBe('TestComponent');
				
				expect(stateChanges[0].updatedOn).not.toEqual(stateChanges[1].updatedOn); // UpdatedOn should be different
				expect(stateChanges[0].updatedOn.getTime()).toBeLessThan(stateChanges[1].updatedOn.getTime()); // UNINITIALIZED should be before OK

				sub.unsubscribe();
			});

			/* Not sure if this should be a requirement
			it('does not emit the same state again', () => {
				const stateChanges: ComponentStateInfo[] = [];
				const sub = component.componentState$.subscribe(state => stateChanges.push({ ...state }));

				component[`${unshadowPrefix}updateState`]({state: ComponentState.OK, reason: 'Test reason'});
				component[`${unshadowPrefix}updateState`]({state: ComponentState.OK, reason: 'Test reason'}); // Same state again

				expect(stateChanges.length).toBe(2); // UNINITIALIZED -> OK -> OK (not emitted again)
				
				sub.unsubscribe();
			});
			*/
		});
	});
});