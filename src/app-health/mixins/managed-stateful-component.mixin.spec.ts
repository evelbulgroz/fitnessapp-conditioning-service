import { take } from 'rxjs';

import { ManagedStatefulComponentMixin } from './managed-stateful-component.mixin';
import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponentOptions from '../models/managed-stateful-component-options.model';

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

describe('ManagedStatefulComponentMixin', () => {
	let component: TestComponent;
	let unshadowPrefix: string;
	beforeEach(() => {
		component = new TestComponent();
		unshadowPrefix = component['unshadowPrefix'];
		jest.clearAllMocks();
	});

	it('can be created as an instance retaining its inheritance from the base class', () => {
		expect(component).toBeDefined();
		expect(component).toBeInstanceOf(TestComponent);
	});
	
	it('should start in UNINITIALIZED state', () => {
		const state = component.getState();
		expect(state.state).toBe(ComponentState.UNINITIALIZED);
	});


	describe('public API', () => {		
		describe('getState', () => {
			it(`returns component's own state if no subcomponents are registered`, () => {
				const state = component.getState();
				expect(state.state).toBe(ComponentState.UNINITIALIZED);
				expect(state.name).toBe('TestComponent');
				expect(state.reason).toBe('Component created');
				expect(state.updatedOn).toBeInstanceOf(Date);
			});

			it(`returns aggregated state if subcomponents are registered`, async () => {
				const subcomponent1 = new TestComponent();
				component[`${unshadowPrefix}registerSubcomponent`](subcomponent1);
				subcomponent1.stateSubject.next({
					name: 'Subcomponent1',
					state: ComponentState.OK,
					reason: 'All good',
					updatedOn: new Date()
				});

				const subComponent2 = new TestComponent();
				component[`${unshadowPrefix}registerSubcomponent`](subComponent2);
				subComponent2.stateSubject.next({
					name: 'Subcomponent2',
					state: ComponentState.DEGRADED,
					reason: 'Minor issue',
					updatedOn: new Date()
				});
				
				await component.initialize();
				expect(component['ownState'].state).toBe(ComponentState.OK);
				const aggregatedState = component.getState();
				expect(aggregatedState.state).toBe(ComponentState.DEGRADED);
				expect(aggregatedState.name).toBe('TestComponent');
				expect(aggregatedState.reason).toContain('Aggregated state [DEGRADED: 2/3, OK: 1/3]');
			});
		});

		describe('options', () => {
			it('gets the options of the component', () => {
				const options: ManagedStatefulComponentOptions = component.options;
				expect(options).toEqual({
					initializationStrategy: 'parent-first',
					shutDownStrategy: 'parent-first',
					subcomponentStrategy: 'parallel'
				});
			});
			
			it('sets the options of the component', () => {
				const newOptions: Partial<ManagedStatefulComponentOptions> = {
					initializationStrategy: 'children-first',
					shutDownStrategy: 'parent-first',
					subcomponentStrategy: 'sequential',
				};
				component.options = newOptions;
				expect(component.options).toEqual(newOptions);
			});
			
			it('is immutable', () => {
				const originalOptions = component.options;
				const newOptions: Partial<ManagedStatefulComponentOptions> = {
					...originalOptions,
					initializationStrategy: 'children-first',
					subcomponentStrategy: 'sequential',
				};
				component.options = newOptions;
				expect(originalOptions).not.toEqual(newOptions);
				expect(originalOptions).toEqual({
					initializationStrategy: 'parent-first',
					shutDownStrategy: 'parent-first',
					subcomponentStrategy: 'parallel'
				});
			});
		});
		
		describe('initialize', () => {
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

		describe('shutdown', () => {
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

	describe('Protected methods', () => {
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

		describe('initializeComponent', () => {
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
				const result = await component.initializeComponent();
				expect(result).toBeUndefined();
			});
			
			it('can be overridden to provide custom initialization logic', async () => {
				component.initDelay = 100; // Simulate a delay
				const startTime = Date.now();
				await component.initializeComponent();
				const endTime = Date.now();
				expect(endTime - startTime).toBeGreaterThanOrEqual(100); // Should take at least 100ms

				expect(component.initCount).toBe(1); // Should be called once
				expect(component.shutdownCount).toBe(0); // Should not be called

				// Reset for clarity
				component.initCount = 0;
				component.shutdownCount = 0;
			});
		});

		describe('registerSubcomponent', () => {
			it('adds a subcomponent to the list', () => {
				const subcomponent = new TestComponent();
				component[`${unshadowPrefix}registerSubcomponent`](subcomponent);
				expect(component.subcomponents).toContain(subcomponent);
			});

			it('does not allow null or undefined subcomponents', () => {
				expect(() => component[`${unshadowPrefix}registerSubcomponent`](null as any)).toThrow(); // Null
				expect(() => component[`${unshadowPrefix}registerSubcomponent`](undefined as any)).toThrow(); // Undefined
			});

			it('does not allow non-component subcomponents', () => {
				expect(() => component[`${unshadowPrefix}registerSubcomponent`]({} as any)).toThrow(); // Non-component
			});

			it('does not allow duplicate subcomponents', () => {
				const subcomponent = new TestComponent();
				component[`${unshadowPrefix}registerSubcomponent`](subcomponent);
				expect(() => component[`${unshadowPrefix}registerSubcomponent`](subcomponent)).toThrow(); // Register again
				expect(component.subcomponents.length).toBe(1); // Should still be only one
			});

			// todo: test subscription to subcomponent state changes when deciding to keep updateAggregatedState() or not
		});

		describe('shutdownComponent', () => {
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
				const result = await component.shutdownComponent();
				expect(result).toBeUndefined();
			});
			it('can be overridden to provide custom shutdown logic', async () => {
				component.shutdownDelay = 100; // Simulate a delay
				const startTime = Date.now();
				await component.shutdownComponent();
				const endTime = Date.now();
				expect(endTime - startTime).toBeGreaterThanOrEqual(100); // Should take at least 100ms

				expect(component.shutdownCount).toBe(1); // Should be called once
				expect(component.initCount).toBe(0); // Should not be called

				// Reset for clarity
				component.initCount = 0;
				component.shutdownCount = 0;
			});
		});

		xdescribe('updateAggregatedState', () => {
			it('updates the aggregated state based on subcomponents', () => {
				const subcomponent1 = new TestComponent();
				const subcomponent2 = new TestComponent();
				component[`${unshadowPrefix}registerSubcomponent`](subcomponent1);
				component[`${unshadowPrefix}registerSubcomponent`](subcomponent2);

				subcomponent1.stateSubject.next({
					name: 'Subcomponent1',
					state: ComponentState.OK,
					reason: 'All good',
					updatedOn: new Date()
				});
				subcomponent2.stateSubject.next({
					name: 'Subcomponent2',
					state: ComponentState.DEGRADED,
					reason: 'Minor issue',
					updatedOn: new Date()
				});

				component.updateAggregatedState();

				const state = component.getState();
				expect(state.state).toBe(ComponentState.DEGRADED);
			});

			it('does not update the aggregated state if no subcomponents are registered', () => {
				component.updateAggregatedState();
				const state = component.getState();
				expect(state.state).toBe(ComponentState.UNINITIALIZED);
			});
		});

		xdescribe('updateState', () => {
			it('updates the state and emits the new state', () => {
				const stateChanges: ComponentStateInfo[] = [];
				component.state$.subscribe(state => stateChanges.push({ ...state }));

				component.updateState({state: ComponentState.OK, reason: 'Test reason'});

				expect(stateChanges.length).toBe(1);
				expect(stateChanges[0].state).toBe(ComponentState.OK);
				expect(stateChanges[0].reason).toBe('Test reason');
			});

			it('does not emit the same state again', () => {
				const stateChanges: ComponentStateInfo[] = [];
				component.state$.subscribe(state => stateChanges.push({ ...state }));

				component.updateState({state: ComponentState.OK, reason: 'Test reason'});
				component.updateState({state: ComponentState.OK, reason: 'Test reason'}); // Same state

				expect(stateChanges.length).toBe(1); // Should only emit once
			});
		});
		
		describe('unregisterSubcomponent', () => {
			it('removes a subcomponent from the list', () => {
				const subcomponent = new TestComponent();
				component[`${unshadowPrefix}registerSubcomponent`](subcomponent);
				component[`${unshadowPrefix}unregisterSubcomponent`](subcomponent);
				expect(component.subcomponents).not.toContain(subcomponent);
			});

			it('does nothing if the subcomponent is not registered', () => {
				const subcomponent = new TestComponent();
				component[`${unshadowPrefix}unregisterSubcomponent`](subcomponent); // Not registered
				expect(component.subcomponents.length).toBe(0); // Should still be empty
			});

			// todo: test subscription to subcomponent state changes when deciding to keep updateAggregatedState() or not
		});
	});
});