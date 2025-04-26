import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponent from '../models/managed-stateful-component';
import ManagedStatefulComponentOptions from '../models/managed-stateful-component-options.model';

/** A mixin that provides a standard implementation of the ManagedStatefulComponent interface.
 * @param Parent The immediate parent class of the target class using this mixin, or `class {}` if the target class does not inherit from any other class.
 * @typeparam TParent The type of the parent class
 * @param unshadowPrefix The prefix to use for internal members to avoid shadowing parent members of the same name. Default is "msc_".
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
 * - Members marked `@internal` are not intended for public access, but must be marked as `public` to be accessible to the mixin.
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
export function ManagedStatefulComponentMixin<TParent extends new (...args: any[]) => any>(
	Parent: TParent,
	unshadowPrefix: string = `msc_${Math.random().toString(36).substring(2, 6)}_` // Default prefix: "managed stateful component" + random string
) {
	abstract class ManagedStatefulComponentClass extends Parent implements ManagedStatefulComponent {
		
		//------------------------------------- PROPERTIES --------------------------------------//
		
		// Prefix internal member names to avoid shadowing parent members of the same name
		public /* @internal */  readonly unshadowPrefix: string;

		// State management properties

		// BehaviorSubject to track the aggregated state of the component and its subcomponents
		public /* @internal */ readonly stateSubject = new BehaviorSubject<ComponentStateInfo>({ 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		});
		
		// Observable to expose the aggregated state as a stream of state changes
		public readonly state$: Observable<ComponentStateInfo> = this.stateSubject.asObservable();

		// Isolated state for the component itself, without subcomponents
		public /* @internal */ ownState: ComponentStateInfo = { 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		};
		
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

		//------------------------------------ CONSTRUCTOR --------------------------------------//

		public constructor(...args: any[]) {
			super(...args); // Call parent constructor, passing any arguments
			this.unshadowPrefix = unshadowPrefix; // Set the unshadow prefix for internal members
		}		

		//------------------------------------- PUBLIC API --------------------------------------//
		
		// Standard getState implementation that supports components with subcomponents
		
		/** Get the component state without updating the state subject
		 * @returns The current state of the component and its subcomponents (if any)
		 * @remark Returns aggregated state if subcomponents are present, otherwise returns the components own state
		 */
		public getState(): ComponentStateInfo {
			// If no subcomponents, just return the current state
			if (this.subcomponents.length === 0) {
				return { ...this.stateSubject.value };
			}
			
			// Get all component states including self
			const states = [
				{ ...this.stateSubject.value }, // Base state without components
				...this.subcomponents.map(c => c.getState())
			];
			
			// Calculate worst state
			const worstState = this[`${unshadowPrefix}calculateWorstState`](states);
			
			// Return the aggregated state without updating the subject
			return {
				name: this.constructor.name,
				state: worstState.state,
				reason: this[`${unshadowPrefix}createAggregatedReason`](states, worstState),
				updatedOn: new Date(),
				components: this.subcomponents.map(c => c.getState())
			};
		}

		/** Set or get component option defaults, e.g. to control component behavior during initialization and shutdown
		 * @param options Options to optionally wholly or partially override defaults (if set)
		 * @returns The current options (if get)
		 * @remark Method exists mostly to avoid overcomplicating the constructor with too many parameters
		 * @remark Options are not intended to be changed after the component is created, but this method allows for some flexibility
		 */
		public set options(options: Partial<ManagedStatefulComponentOptions>) {
			this._options = {
				...this._options,
				...options
			};
		}		
		public get options(): ManagedStatefulComponentOptions {
			return {...this._options};
		}
	
		/** Initialize the component and all of its subcomponents (if any) if it is not already initialized
		 * @param args Optional arguments to pass to parent initialize methods 
		 * @returns Promise that resolves when the component and all of its subcomponents are initialized
		 * @throws Error if initialization fails
		 * @remark Executes any inherited initialize() method before executing subclass initialize() logic
		 * @remark Subclasses may optionally override `executeInitialization()` to provide component-specific initialization logic
		 * @remark Transitions state to `INITIALIZING` during the process and to `OK` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during initialization
		 * @remark If the component is already initialized, resolves immediately
		 */
		public async initialize(...args: any[]): Promise<void> {
			// If already initialized, resolve immediately
			if (this.stateSubject.value.state !== ComponentState.UNINITIALIZED) {
				return Promise.resolve();
			}
		
			// If initialization is already in progress, return the existing promise
			if (this.initializationPromise) {
				return this.initializationPromise;
			}			
			
			// Create a new initialization promise
			this.initializationPromise = new Promise<void>(async (resolve, reject) => {
				try {
					// Set own state and update the state subject with the new state
					this.ownState = ({
						name: this.constructor.name,
						state: ComponentState.INITIALIZING,
						reason: 'Component initialization in progress',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this.ownState); // returns when state change is observed

					// Call parent initialize method if found (preserving inheritance)
					await this[`${unshadowPrefix}callParentMethod`](this.initialize, ...args);

					// Initialize main component and any subcomponents in the order specified in options
					if (this.options.initializationStrategy === 'parent-first') {
						await this.initializeComponent();
						await this[`${unshadowPrefix}initializeSubcomponents`]();
					} else { // 'children-first'
						await this[`${unshadowPrefix}initializeSubcomponents`]();
						await this.initializeComponent();
					}
					
					// Set own state and update the state subject with the new state
					this.ownState = ({
						name: this.constructor.name,
						state: ComponentState.OK,
						reason: 'Component initialized successfully',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this.ownState); // returns when state change is observed

					resolve();
				} 
				catch (error) {
					this.ownState = ({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component initialization failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this.ownState); // returns when state change is observed
										
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
		 * @remark Ignores any inherited isReady() method, as isReady() is considered purely informational
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
		 * @param args Optional arguments to pass to parent shutdown methods
		 * @returns Promise that resolves when the component and all of its subcomponents are shut down
		 * @throws Error if shutdown fails
		 * @remark Executes any inherited shutdown() method before executing subclass shutdown() logic
		 * @remark Subclasses may optionally override `executeShutdown()` to provide component-specific shutdown logic
		 * @remark Transitions state to `SHUTTING_DOWN` during the process and to `SHUT_DOWN` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during shutdown
		 * @remark If the component is already shut down, resolves immediately
		 */
		public async shutdown(...args: any[]): Promise<void> {
			// If already shut down, resolve immediately
			if (this.stateSubject.value.state === ComponentState.SHUT_DOWN) {
				return Promise.resolve();
			}

			// If shutdown is already in progress, return the existing promise
			if (this.shutdownPromise) {
				return this.shutdownPromise;
			}

			this.shutdownPromise = new Promise<void>(async (resolve, reject) => {
				try {
					// Set own state and update the state subject with the new state
					this.ownState = ({
						name: this.constructor.name,
						state: ComponentState.SHUTTING_DOWN,
						reason: 'Component shutdown in progress',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this.ownState); // returns when state change is observed

					// Call parent shutdown method if found (preserving inheritance)
					await this[`${unshadowPrefix}callParentMethod`](this.shutdown, ...args);

					// Shut down main component and any subcomponents in the order specified in options
					if (this.options.shutDownStrategy === 'parent-first') {
						await this.shutdownComponent();
						await this[`${unshadowPrefix}shutdownSubcomponents`];
					} else { // 'children-first'
						await this[`${unshadowPrefix}shutdownSubcomponents`];
						await this.shutdownComponent();
					}

					// Set own state and update the state subject with the new state
					this.ownState = ({
						name: this.constructor.name,
						state: ComponentState.SHUT_DOWN,
						reason: 'Component shut down successfully',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this.ownState); // returns when state change is observed
					
					resolve();
				} 
				catch (error) {
					// Update state to indicate shutdown failure
					this.ownState = ({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this.ownState); // returns when state change is observed
					
					reject(error);
				}
				finally {
					this.shutdownPromise = undefined;
				}
			});

			return this.shutdownPromise;
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
		
		/* Call parent method shadowed by this mixin
		 * @param method The method to call in the parent class hierarchy
		 * @returns The result of the parent method call, or undefined if not found
		 * @throws Error if the method is not found in the parent class hierarchy
		 */
		public /* @internal */ async [`${unshadowPrefix}callParentMethod`](method: Function, ...args: any[]): Promise<any> {
			// Extract the method name from the function
			const methodName = method.name;
			if (!methodName) {
				throw new Error('Method name could not be determined from function reference');
			}

			// Store reference to our own implementation
			const mixinMethod = (ManagedStatefulComponentClass.prototype as any)[methodName];
			if (!mixinMethod) {
				throw new Error(`Method ${methodName} not found in mixin`);
			}

			// Try to find parent class implementation (if any)
			let parentMethod = this[`${unshadowPrefix}findParentMethodOf`](method);
			if (parentMethod) {
				// If the parent method is the same as the mixin method, return undefined
				if (parentMethod === mixinMethod) {
					return undefined;
				}
				// Else, call the parent method and return the result
				return await parentMethod.call(this, ...args);
			}
			
			return undefined; // No parent method found, return undefined
		}
		
		/* Calculate the worst state from a collection of states
		 * @param states Collection of component states
		 * @returns The worst state from known states
		 * @returns The worst of known states or either DEGRADED, if unknown states are present
		 * @returns DEGRADED if no known states are present
		 * @throws Error if states array is empty
		 * @remark Logs a warning if unknown states are encountered
		 */
		public /* @internal */ [`${unshadowPrefix}calculateWorstState`](states: ComponentStateInfo[]): ComponentStateInfo {
			if (states.length === 0) {
			throw new Error('Cannot calculate worst state from an empty array');
			}
		
			const statePriority = [ // Priority order for states (highest/worst priority first)
				ComponentState.FAILED,
				ComponentState.SHUT_DOWN,
				ComponentState.SHUTTING_DOWN,
				ComponentState.INITIALIZING,
				ComponentState.UNINITIALIZED,
				ComponentState.DEGRADED,
				ComponentState.OK
			];
			
			// Track if we encounter any unknown states
			let hasUnknownStates = false;
			
			// Find the highest priority (worst) state
			let worstState: ComponentStateInfo | undefined;
			let worstPriority = -1;
			
			// Iterate through the states and find the one with the highest priority
			for (const state of states) {
				const priority = statePriority.indexOf(state.state);
				
				if (priority === -1) {
					// Track that we found an unknown state
					hasUnknownStates = true;
					//console.warn(`Unknown state encountered: ${state.state}`, state);
					continue;
				}
				
				if (worstState === undefined || priority < worstPriority) {
					worstState = state;
					worstPriority = priority;
				}
			}
			
			// If we only had unknown states or calculation failed for some other reason
			if (!worstState) {
				console.warn(
					'Failed to determine component state, falling back to DEGRADED state',
					`${this.constructor.name}.calculateWorstState()`,
					//states
				);
				
				return {
					name: this.constructor.name,
					state: ComponentState.DEGRADED,
					reason: 'State calculation anomaly - unknown states encountered',
					updatedOn: new Date()
				};
			}
			
			// If we found unknown states, return the worst of DEGRADED or the found worstState
			if (hasUnknownStates) {
				console.warn(
					`Unknown states were encountered during state calculation, returning worst state, or DEGRADED if worse`,
					`${this.constructor.name}.calculateWorstState()`,
					//states
				);
				
				// Get the priority of DEGRADED state
				const degradedPriority = statePriority.indexOf(ComponentState.DEGRADED);
				
				// If DEGRADED is worse than the found worst state, return a DEGRADED state
				if (degradedPriority < worstPriority) {
					return {
					name: this.constructor.name,
					state: ComponentState.DEGRADED,
					reason: 'Component degraded due to unknown states',
					updatedOn: new Date()
					};
				}
				
				// Otherwise, return the found worst state (which is worse than DEGRADED)
				return worstState;
			}
			
			// If we have a valid worst state and no unknown states, return it
			return worstState;
		}
		
		/* Create a human-readable reason string for aggregated component states
		 * @param states Collection of component states
		 * @param worstState The worst state from the collection
		 * @returns A human-readable reason string
		 */
		public /* @internal */ [`${unshadowPrefix}createAggregatedReason`](states: ComponentStateInfo[], worstState: ComponentStateInfo): string {
			// Count components in each state
			const stateCounts: Record<string, number> = {};			
			states.forEach(state => {
				const stateValue = String(state.state);
				stateCounts[stateValue] = (stateCounts[stateValue] || 0) + 1;
			});
			
			// Create state summary string
			const stateSummary = Object.entries(stateCounts)
				.map(([state, count]) => `${state}: ${count}/${states.length}`)
				.join(', ');
			
			// Create detailed reason based on worst state
			let worstReason = '';
			if (worstState) {
				// Always include the name if available
				worstReason = worstState.name || 'Unknown';
				
				// Only add reason if it exists and is not undefined
				if (worstState.reason) {
					worstReason += ` - ${worstState.reason}`;
				}
			}
			
			return `Aggregated state [${stateSummary}]. Worst: ${worstReason}`;
		}

		/** Find a method in the parent class hierarchy that may be shadowed by this mixin
		 * @param method The method to find in the parent class hierarchy
		 * @returns The parent method if found, undefined otherwise
		 * @internal
		 */
		public /* @internal */ [`${unshadowPrefix}findParentMethodOf`](method: Function): Function | undefined {
			// Extract the method name from the function
			const methodName = method.name;
			
			if (!methodName) {
				throw new Error('Method name could not be determined from function reference');
			}
			
			// Store reference to our own implementation
			const mixinMethod = (ManagedStatefulComponentClass.prototype as any)[methodName];
			
			if (!mixinMethod) {
				throw new Error(`Method ${methodName} not found in mixin`);
			}
			
			// Try to find parent class implementation (if any)
			let proto = Object.getPrototypeOf(Object.getPrototypeOf(this));
			
			// Look for a method in the parent chain that isn't our own
			while (proto) {
				if (proto[methodName] && proto[methodName] !== mixinMethod) {
					return proto[methodName];
				}
				proto = Object.getPrototypeOf(proto);
			}
			
			return undefined;
		}

		/* Initialize subcomponents
		 * @returns Promise that resolves when all subcomponents are initialized
		 * @throws Error if initialization fails
		 * @remark defaults to parallel initialization
		 * @remark Sequential initialization is slower but guarantees that subcomponents are initialized in the order they were registered
		 */
		public /* @internal */ async [`${unshadowPrefix}initializeSubcomponents`](): Promise<void> {
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
		
		/* Register a subcomponent to be managed by this component
		 * @param component The subcomponent to register
		 * @returns void
		 * @throws Error if the component is null, undefined, or already registered
		 * @remark This method is intended for internal use and should not be called directly by clients.
		 * @remark It is used to manage the lifecycle of subcomponents and ensure they are properly initialized and shut down.
		 * @remark The component must be an instance of ManagedStatefulComponent.
		 */
		public /* @internal */ [`${unshadowPrefix}registerSubcomponent`](component: ManagedStatefulComponent): void {
			if (!component) {
				throw new Error('Component cannot be null or undefined');
			}
			else if (!(component instanceof ManagedStatefulComponentClass)) {
				throw new Error('Component must be an instance of ManagedStatefulComponent');
			}
			else if (this.subcomponents.includes(component)) {
				throw new Error('Component is already registered as a subcomponent');
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

		/* Shut down subcomponents
		 * @returns Promise that resolves when all subcomponents are shut down
		 * @throws Error if shutdown fails
		 * @remark defaults to parallel shutdown
		 * @remark Sequential shutdown is slower but guarantees that subcomponents are shut down in the reverse order they were registered
		 */
		public /* @internal */ async [`${unshadowPrefix}shutdownSubcomponents`](): Promise<void> {
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
		
		/* DEPRECATED?: Aggregated state calculation (used by composite components)
		 * @todo Refactor callers to use e.g. `updateState()` instead, if possible, then retire
		 * @remark New code should possibly not rely on this method
		 */
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
			const worstState = this[`${unshadowPrefix}calculateWorstState`](states);
			
			// Update the state
			this.stateSubject.next({
				name: this.constructor.name,
				state: worstState.state,
				reason: this[`${unshadowPrefix}createAggregatedReason`](states, worstState),
				updatedOn: new Date(),
				components: this.subcomponents.map(c => c.getState())
			});
		}

		/* Update the state of the component and optionally its subcomponents
		 * @param state The new state to set
		 * @returns Promise that resolves when the state update has fully propagated
		 * @remark Waits for state change to propagate before resolving (i.e. "Wait for Your Own Events" pattern to ensure consistency)
		 */
		public /* @internal */ async [`${unshadowPrefix}updateState`](newState: Partial<ComponentStateInfo>): Promise<void> {
			// Create updated state object
			let updatedState: ComponentStateInfo = {
				...this.stateSubject.value, // merge current aggregated state with...
				...newState, // ...new state values...
				updatedOn: new Date() // ...and update the timestamp
			};

			// For components with subcomponents, recalculate the aggregated state
			if (this.subcomponents?.length > 0) {
				// We need to preserve the partial updates from newState
				const baseState = {
				...this.stateSubject.value,
				...newState
				};
				
				// Calculate the aggregated state with updated properties
				const states = [
					baseState,
					...this.subcomponents.map((c: ManagedStatefulComponent) => c.getState())
				];				
				const worstState = this[`${unshadowPrefix}calculateWorstState`](states);
				
				// Create the final aggregated state
				updatedState = {
					...baseState,
					state: worstState.state,
					reason: this[`${unshadowPrefix}createAggregatedReason`](states, worstState),
					updatedOn: new Date(),
					components: this.subcomponents.map(c => c.getState())
				};
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

			return void 0; // State update complete
		}
		
		/* Unregister a subcomponent from this component
		 * @param component The subcomponent to unregister
		 * @returns true if the component was successfully unregistered, false otherwise
		 * @throws Error if the component is null or undefined
		 * @remark This method is intended for internal use and should not be called directly by clients.
		 * @remark It is used to manage the lifecycle of subcomponents and ensure they are properly initialized and shut down.
		 * @remark The component must be an instance of ManagedStatefulComponent.
		 */
		public /* @internal */ [`${unshadowPrefix}unregisterSubcomponent`](component: ManagedStatefulComponent): boolean {
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
	}
	
	return ManagedStatefulComponentClass;
}
export default ManagedStatefulComponentMixin;