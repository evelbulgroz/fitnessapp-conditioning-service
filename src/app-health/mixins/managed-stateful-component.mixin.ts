import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take, tap } from 'rxjs';

import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponent from '../models/managed-stateful-component';
import ManagedStatefulComponentOptions from '../models/managed-stateful-component-options.model';

/** A mixin that provides a standard implementation of the ManagedStatefulComponent interface.
 * @param Parent The immediate parent class of the target class using this mixin, or `class {}` if the target class does not inherit from any other class.
 * @typeparam TParent The type of the parent class
 * @returns A class that implements ManagedStatefulComponent and extends the provided parent class (if any)
 * @remark This mixin inserts a standard implementation of the ManagedStatefulComponent interface into the existing class hierarchy, which it otherwise leaves intact.
 * @remark Anonymous classes in TypeScript cannot have non-public members. Instead, members not intended for the public API are marked as `@internal`.
 * - It is up to clients to respect this convention, as it is not enforced by TypeScript.
 * @todo Figure out how to support logging without introducing a Logger dependency, and without conflicting with e.g. Repository' logs$ Observable
 * 
 * @example Class that does not inherit and uses this mixin:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(class {}) {
 *		// Implement the required methods and properties here
 *		public async executeInitialization(): Promise<void> {
 *			// Component-specific initialization logic goes here
 *		}
 *		public async executeShutdown(): Promise<void> {
 *			// Component-specific shutdown logic goes here
 *		}
 * }
 * ```
 * 
 * @example Class that inherits from a parent class and uses this mixin:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(ParentClass) {
 *		// Implement the required methods and properties here
 *		public async executeInitialization(): Promise<void> {
 *			// Component-specific initialization logic goes here
 *		}
 *		public async executeShutdown(): Promise<void> {
 *			// Component-specific shutdown logic goes here
 *		}
 *	}
 * ```
 *
 * IMPLEMENTATION REQUIREMENTS
 * Classes using this mixin must implement two public methods:
 * `executeInitialization(): Promise<void>` - Component specific logic to be executed during initialization, called from `initialize()`
 * `executeShutdown(): Promise<void>` - Component specific logic to be executed during shutdown, called from `shutdown()`
 * 
 * Classes using this mixin must also implement a `logger` property of type Logger compatible with the `@evelbulgroz/logger` API.
 * This logger will be used for logging state changes and errors during initialization and shutdown.
 * 
 * INHERITANCE CONSIDERATIONS
 * - If the parent class already has `initialize()` or `shutdown()` methods, the mixin will shadow them.
 * - If your parent class has its own initialization or shutdown logic, you MUST call the parent methods 
 *	 explicitly from your `executeInitialization()` or `executeShutdown()` implementations, e.g.:
 *	 ```typescript
 *	 public executeInitialization(): Promise<void> {
 *		 // First call parent class initialization if needed
 *		 await super.initialize();
 *		 
 *		 // Then do component-specific initialization
 *		 // ...
 *		 
 *		 return Promise.resolve();
 *	 }
 *	 ```
 * 
 * CAUTIONS
 * - Properties `stateSubject`, `initializationPromise` and `shutdownPromise` are not intended for public access, 
 *	 but must be marked as public to be accessible to the mixin.
 * - The mixin's implementation of `initialize()` and `shutdown()` does NOT automatically call parent class methods 
 *	 with the same name.
 * - Avoid applying this mixin to classes that already implement the ManagedStatefulComponent interface (e.g. using this mixin), as this will introduce unnessesary complexity and potential conflicts.
 * 
 * TYPESAFETY
 * When using with multiple inheritance or complex class hierarchies, you may need to use declaration merging to ensure proper TypeScript type checking:
 * ```typescript
 * interface MyClass extends ReturnType<typeof ManagedStatefulComponentMixin> {}
 * ```
 */
export function ManagedStatefulComponentMixin<TParent extends new (...args: any[]) => any>(Parent: TParent) {
	abstract class ManagedStatefulComponentClass extends Parent implements ManagedStatefulComponent {
		
		//------------------------------------- PROPERTIES --------------------------------------//
		
		// State management properties
		public /* @internal */ readonly stateSubject = new BehaviorSubject<ComponentStateInfo>({ 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		});
		
		public readonly state$: Observable<ComponentStateInfo> = this.stateSubject.asObservable();
		
		// Optional subcomponent support
		public /* @internal */ subcomponents: ManagedStatefulComponent[] = [];
		public /* @internal */ componentSubscriptions: Map<ManagedStatefulComponent, Subscription> = new Map();

		// Initialization and shutdown promises
		public /* @internal */ initializationPromise?: Promise<void>;
		public /* @internal */ shutdownPromise?: Promise<void>;

		// Default options for initialization and shutdown strategies
		public /* @internal */ _options: ManagedStatefulComponentOptions = { // underscore to enable setter/getter naming
			initializationStrategy: 'parent-first',
			shutDownStrategy: 'parent-first',
			subcomponentStrategy: 'parallel'
		};

		//------------------------------------- PUBLIC API --------------------------------------//
		
		// Standard getState implementation that supports components with subcomponents
		public getState(): ComponentStateInfo {
			const baseState = { ...this.stateSubject.value };
			
			// If we have subcomponents, include their states
			if (this.subcomponents.length > 0) {
				return {
					...baseState,
					components: this.subcomponents.map(c => c.getState())
				};
			}
			
			return baseState;
		}
		
		/** Initialize the component and all of its subcomponents (if any) if it is not already initialized
		 * @returns Promise that resolves when the component and all of its subcomponents are initialized
		 * @throws Error if initialization fails
		 * @remark Subclasses may optionally override `executeInitialization()` to provide component-specific initialization logic
		 * @remark Transitions state to `INITIALIZING` during the process and to `OK` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during initialization
		 * @remark If the component is already initialized, resolves immediately
		 */
		public initialize(): Promise<void> {
			// If already initialized, resolve immediately
			if (this.stateSubject.value.state !== ComponentState.UNINITIALIZED) {
				return Promise.resolve();
			}
		
			// If initialization is already in progress, return the existing promise
			if (this.initializationPromise) {
				return this.initializationPromise;
			}
		
			// Set the internal state to indicate initialization in progress
			this.stateSubject.next({
				name: this.constructor.name,
				state: ComponentState.INITIALIZING,
				reason: 'Component initialization in progress',
				updatedOn: new Date()
			});
			
			// Create a new initialization promise
			this.initializationPromise = new Promise<void>(async (resolve, reject) => {
				try {
					// Initialize main component and any subcomponents in the order specified in options
					if (this.options.initializationStrategy === 'parent-first') {
						await this.initializeComponent();
						await this.initializeSubcomponents();
					} else { // 'children-first'
						await this.initializeSubcomponents();
						await this.initializeComponent();
					}
					
					// Update state to indicate successful initialization, and wait for the state change to propagate
					await this.updateState({
						name: this.constructor.name,
						state: ComponentState.OK,
						reason: 'Component initialized successfully',
						updatedOn: new Date()
					});

					resolve();
				} 
				catch (error) {
					await this.updateState({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component initialization failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					
					reject(error);
				}
				finally {
					this.initializationPromise = undefined;
				}
			});
		
			return this.initializationPromise;
		}		

		/** Check if the component, including any subcomponents, is ready to serve requests
		 * @returns Promise that resolves to true if ready, false otherwise
		 * @throws Error if the component or any of its subcomponents is not ready
		 * @remark May trigger initialization if the component supports lazy initialization
		 * @remark A component is typically ready when it and all of its subcomponents are in the `OK` or `DEGRADED` state
		 */
		public async isReady(): Promise<boolean> {
			try {
				// Check if this component is ready
				if (this.stateSubject.value.state === ComponentState.UNINITIALIZED) {
					await this.initialize();
				}
				
				const isThisComponentReady = 
					this.stateSubject.value.state === ComponentState.OK || 
					this.stateSubject.value.state === ComponentState.DEGRADED;
				
				// If no subcomponents or this component isn't ready, return the result
				if (!this.subcomponents.length || !isThisComponentReady) {
					return isThisComponentReady;
				}
				
				// Check if all subcomponents are ready
				const subcomponentReadyStates = await Promise.all(
					this.subcomponents.map(async component => {
						try {
							return await component.isReady();
						}
						catch (error) {
							return false;
						}
					})
				);
				
				// Component is ready if it and all subcomponents are ready
				return isThisComponentReady && subcomponentReadyStates.every(ready => ready);
			}
			catch (error) {
				return false;
			}
		}
		
		/** Shutdown the component and all of its subcomponents (if any) if it is not already shut down
		 * @returns Promise that resolves when the component and all of its subcomponents are shut down
		 * @throws Error if shutdown fails
		 * @remark Subclasses may optionally override `executeShutdown()` to provide component-specific shutdown logic
		 * @remark Transitions state to `SHUTTING_DOWN` during the process and to `SHUT_DOWN` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during shutdown
		 * @remark If the component is already shut down, resolves immediately
		 */
		public shutdown(): Promise<void> {
			// If already shut down, resolve immediately
			if (this.stateSubject.value.state === ComponentState.SHUT_DOWN) {
				return Promise.resolve();
			}

			// If shutdown is already in progress, return the existing promise
			if (this.shutdownPromise) {
				return this.shutdownPromise;
			}

			// Set the internal state to indicate shutdown in progress
			this.stateSubject.next({
				name: this.constructor.name,
				state: ComponentState.SHUTTING_DOWN,
				reason: 'Component shutdown in progress',
				updatedOn: new Date()
			});

			this.shutdownPromise = new Promise<void>(async (resolve, reject) => {
				try {
					// Shut down main component and any subcomponents in the order specified in options
					if (this.options.shutDownStrategy === 'parent-first') {
						await this.shutdownComponent();
						await this.shutdownSubcomponents();
					} else { // 'children-first'
						await this.shutdownSubcomponents();
						await this.shutdownComponent();
					}
					
					// Update state to indicate successful shutdown
					await this.updateState({
						name: this.constructor.name,
						state: ComponentState.SHUT_DOWN,
						reason: 'Component shut down successfully',
						updatedOn: new Date()
					});					
					
					resolve();
				} 
				catch (error) {
					// Update state to indicate shutdown failure
					await this.updateState({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					
					reject(error);
				}
				finally {
					this.shutdownPromise = undefined;
				}
			});

			return this.shutdownPromise;
		}

		/** Set or get component option defaults, e.g. to control component behavior during initialization and shutdown
		 * @param options Options to optionally wholly or partially override defaults (if set)
		 * @returns The current options (if get)
		 * @remark Method exists mostly to avoid overcomplicating the constructor with too many parameters
		 * @remark Options are not intended to be changed after the component is created, but this method allows for some flexibility
		 */
		public set options(options: Partial<ManagedStatefulComponentOptions>) {
			this.options = {
				...this._options,
				...options
			};
		}		
		public get options(): ManagedStatefulComponentOptions {
			return {...this._options};
		}
	
		//---------------------------------- TEMPLATE METHODS -----------------------------------//

		// NOTE: TS does not support protected members in abstract classes, so we use public with @internal tag

		/** Execute component-specific initialization
		 * @returns Promise that resolves when initialization is complete
		 * @throws Error if initialization fails
		 * @remark This method can be overridden by subclasses that have specific initialization needs.
		 * @remark It is called from `initialize()` and should contain the component-specific logic for initialization.
		 * @remark It should leave it to initialize() to handle the state management and observable emissions.
		 * @remark A default implementation is provided that simply resolves the promise.
		 */
		public /* @internal */ initializeComponent(): Promise<void> { return Promise.resolve(); }
		
		/** Execute component-specific shutdown
		 * @returns Promise that resolves when shutdown is complete
		 * @throws Error if shutdown fails
		 * @remark This method can be overridden by subclasses that have specific shutdown needs.
		 * @remark It is called from `shutdown()` and should contain the component-specific logic for shutdown.
		 * @remark It should leave it to shutdown() to handle the state management and observable emissions.
		 * @remark A default implementation is provided that simply resolves the promise.
		 */
		public /* @internal */ shutdownComponent(): Promise<void> { return Promise.resolve(); }

		//--------------------------------- PROTECTED METHODS -----------------------------------//
		
		// NOTE: TS does not support protected members in abstract classes, so we use public with @internal tag

		// Initialize subcomponents
		  // Defaults to parallel initialization
		  // Sequential initialization is slower but guarantees that subcomponents are initialized in the order they were registered
		public /* @internal */ async initializeSubcomponents(): Promise<void> {
			if (this.subcomponents.length === 0) return;
			
			if (this.options.subcomponentStrategy === 'parallel') { // fastest				
				await Promise.all(this.subcomponents.map(component => component.initialize()));
			}
			else { // sequential, slower but guaranteed to respect registration order
				for (const component of this.subcomponents) {
					await component.initialize();
				}
			}
		}

		// Shutdown subcomponents
		  // Defaults to parallel shutdown
		  // Sequential shutdown is slower but guarantees that subcomponents are shut down in the reverse order they were registered
		public /* @internal */ async shutdownSubcomponents(): Promise<void> {
			if (this.subcomponents.length === 0) return;
			
			if (this.options.subcomponentStrategy === 'parallel') { // fastest
				await Promise.all(this.subcomponents.map(component => component.shutdown()));
			}
			else { // sequential, slower but guaranteed to respect registration order
				for (const component of this.subcomponents.reverse()) {
					await component.shutdown();
				}
			}
		}
		
		// Component registration methods (optional, used only by composite components)
		public /* @internal */ registerComponent(component: ManagedStatefulComponent): void {
			if (!component) {
				throw new Error('Component cannot be null or undefined');
			}
			
			this.subcomponents.push(component);
			
			// Subscribe to component state changes
			const subscription = component.state$.subscribe(state => {
				// Update the aggregated state when a subcomponent's state changes
				this.updateAggregatedState();
			});
			
			this.componentSubscriptions.set(component, subscription);
			
			// Update the aggregated state to include the new component
			this.updateAggregatedState();
		}
		
		public /* @internal */ unregisterComponent(component: ManagedStatefulComponent): boolean {
			const index = this.subcomponents.indexOf(component);
			if (index === -1) {
				return false;
			}
			
			// Clean up subscription
			const subscription = this.componentSubscriptions.get(component);
			if (subscription) {
				subscription.unsubscribe();
				this.componentSubscriptions.delete(component);
			}
			
			// Remove component
			this.subcomponents.splice(index, 1);
			
			// Update the aggregated state
			this.updateAggregatedState();
			
			return true;
		}
		
		// DEPRECATED: Aggregated state calculation (used by composite components)
		  // TODO: Refactor callers to use e.g. `updateState()` instead, if possible, then retire
		  // NOTE New code should not rely on this method
		public /* @internal */ updateAggregatedState(): void {
			if (this.subcomponents.length === 0) {
				return; // Nothing to aggregate
			}
			
			// Get all component states including self
			const states = [
				{ ...this.stateSubject.value }, // Base state without components
				...this.subcomponents.map(c => c.getState())
			];
			
			// Calculate worst state
			const worstState = this.calculateWorstState(states);
			
			// Update the state
			this.stateSubject.next({
				name: this.constructor.name,
				state: worstState.state,
				reason: this.createAggregatedReason(states, worstState),
				updatedOn: new Date(),
				components: this.subcomponents.map(c => c.getState())
			});
		}

		/** Update the state of the component and optionally its subcomponents, waiting for state changes to propagate
		 * @param state The new state to set
		 * @returns Promise that resolves when the state update has fully propagated
		 * @remark Uses the "Wait for Your Own Events" pattern to ensure state consistency
		 */
		public /* @internal */ async updateState(newState: Partial<ComponentStateInfo>): Promise<void> {
			// Create updated state object
			const updatedState: ComponentStateInfo = {
				...this.stateSubject.value,
				...newState,
				updatedOn: new Date()
			};
			
			// Include subcomponents if present
			if (this.subcomponents.length > 0) {
				updatedState.components = this.subcomponents.map(c => c.getState());
			}
			
			// Create a promise that resolves when this state change is observed
			const stateUpdatePromise = firstValueFrom(
				this.state$.pipe(
					filter(state => 
						// Match on state value and timestamp to ensure we're waiting for this specific update
						state.state === updatedState.state && 
						state.updatedOn >= updatedState.updatedOn
					),
					take(1)
				)
			);
			
			// Update the state
			this.stateSubject.next(updatedState);
			
			// Wait for state update to propagate through the observable chain
			await stateUpdatePromise;
		}
		
		/** Calculate the worst state from a collection of states
				 * @param states Collection of component states
				 * @returns The worst state found
				 * @private
				 */
		public /* @internal */ calculateWorstState(states: ComponentStateInfo[]): ComponentStateInfo {
			// Priority order for states (highest/worst priority first)
			const statePriority = [
				ComponentState.FAILED,
				ComponentState.SHUT_DOWN,
				ComponentState.SHUTTING_DOWN,
				ComponentState.INITIALIZING,
				ComponentState.UNINITIALIZED,
				ComponentState.DEGRADED,
				ComponentState.OK
			];
			
			// Find the highest priority (worst) state
			let worstState: ComponentStateInfo | undefined;
			let worstPriority = -1;
			
			states.forEach(state => {
				const priority = statePriority.indexOf(state.state);
				if (priority >= 0 && (worstState === undefined || priority < worstPriority)) {
					worstState = state;
					worstPriority = priority;
				}
			});
			
			return worstState || states[0]; // Fallback to first state if calculation failed
		}
		
		/** Create a human-readable reason for the aggregated state
		 * @param states All component states
		 * @param worstState The worst state found
		 * @returns A descriptive reason string
		 * @private
		 */
		public /* @internal */ createAggregatedReason(states: ComponentStateInfo[], worstState: ComponentStateInfo): string {
			// Count components in each state
			const stateCounts = states.reduce((counts, state) => {
				counts[state.state] = (counts[state.state] || 0) + 1;
				return counts;
			}, {} as Record<string, number>);
			
			// Format as a string
			const totalComponents = states.length;
			const countString = Object.entries(stateCounts)
				.map(([state, count]) => `${state}: ${count}/${totalComponents}`)
				.join(', ');
			
			return `Aggregated state [${countString}]. Worst: ${worstState.name} - ${worstState.reason}`;
		}		
	}
	
	return ManagedStatefulComponentClass;
}
export default ManagedStatefulComponentMixin;