import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import ComponentState from '../models/component-state.enum';
import ComponentStateInfo from '../models/component-state-info.model';
import ManagedStatefulComponent from '../models/managed-stateful-component.model';
import ManagedStatefulComponentOptions from '../models/managed-stateful-component-options.model';

/** A mixin that provides a standard implementation of the ManagedStatefulComponent interface.
 * @typeparam TParent The type of the parent class
 * @param Parent The immediate parent class of the target class using this mixin, or `class {}` if the target class does not inherit from any other class.
 * @param options Options to configure the mixin behavior, such as initialization and shutdown strategies.
 * @param unshadowPrefix The prefix to use for internal members to avoid shadowing parent members of the same name. Default is "msc_".
 * @returns A class that implements ManagedStatefulComponent and extends the provided parent class (if any).
 * @remark This mixin inserts a standard implementation of the ManagedStatefulComponent interface into the existing class hierarchy.
 * @remark All public API method names are required by `ManagedStatefulComponent`, reserved for the mixin.
 * - `initialize()` and `shutdown()` methods preserve inheritance and pass the call up the class hierarchy.
 * - `isReady()` shadows any inherited method of the same name, as it is considered purely informational.
 * @remark Template methods `initializeStateFulComponent()` and `shutdownStateFulComponent()` are reserved for the mixin and will shadow any similarly named methods in the class hierarchy.
 * @remark Anonymous classes in TypeScript cannot have non-public members. Instead, members not intended for the public API are marked as `@internal`.
 * @remark All `@internal` member names are prefixed with `msc_*` to reduce the risk of shadowing parent members of the same name.
 * @todo Figure out how to support logging without introducing a Logger dependency, and without conflicting with e.g. Repository' logs$ Observable
 * 
  * @example Class that does not inherit and uses this mixin:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(class {}) {
 *		// Implement the required methods and properties here
 *		public async initializeStateFulComponent(): Promise<void> {
 *			// Component-specific initialization logic goes here
 *		}
 *		public async shutdownStateFulComponent(): Promise<void> {
 *			// Component-specific shutdown logic goes here
 *		}
 * }
 * ```
 * 
 * @example Class that inherits from a parent class and uses this mixin:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(ParentClass) {
 *		// Implement the required methods and properties here
 *		public async initializeStateFulComponent(): Promise<void> {
 *			// Component-specific initialization logic goes here
 *		}
 *		public async shutdownStateFulComponent(): Promise<void> {
 *			// Component-specific shutdown logic goes here
 *		}
 *	}
 * ```
 *
 * TYPESAFETY
 * When using with multiple inheritance or complex class hierarchies, you may need to use declaration merging to ensure proper TypeScript type checking:
 * ```typescript
 * interface MyClass extends ReturnType<typeof ManagedStatefulComponentMixin> {}
 * ```
 */
export function ManagedStatefulComponentMixin<TParent extends new (...args: any[]) => any>(
	Parent: TParent,
	options: ManagedStatefulComponentOptions = {
		initializationStrategy: 'parent-first',
		shutDownStrategy: 'parent-first',
		subcomponentStrategy: 'parallel'
	},
	unshadowPrefix: string = `msc_${Math.random().toString(36).substring(2, 6)}_` // Default prefix: "managed stateful component" + random string
) {
	abstract class ManagedStatefulComponentClass extends Parent implements ManagedStatefulComponent {
		
		//------------------------------------- PROPERTIES --------------------------------------//
		
		/* Prefix for internal method names to avoid shadowing parent methods of the same name
		 * - itself prefixed manually to avoid shadowing any parent property of the same name
		 */
		/* @internal */  readonly msc_zh7y_unshadowPrefix: string;

		// State management properties

		/* BehaviorSubject to track the aggregated state of the component and its subcomponents */
		/* @internal */ readonly  msc_zh7y_stateSubject = new BehaviorSubject<ComponentStateInfo>({ 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		});
		
		
		/* Isolated state for the component itself, without subcomponents */
		/* @internal */ msc_zh7y_ownState: ComponentStateInfo = { 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		};
		
		// Optional subcomponent support
		/* @internal */ msc_zh7y_subcomponents: ManagedStatefulComponent[] = [];
		/* @internal */ msc_zh7y_componentSubscriptions: Map<ManagedStatefulComponent, Subscription> = new Map();

		// Initialization and shutdown promises
		/* @internal */ msc_zh7y_initializationPromise?: Promise<void>;
		/* @internal */ msc_zh7y_shutdownPromise?: Promise<void>;

		/* Default options for initialization and shutdown strategies */
		/* @internal */ msc_zh7y_options: ManagedStatefulComponentOptions = { // no underscore, prefix does the job
			initializationStrategy: 'parent-first',
			shutDownStrategy: 'parent-first',
			subcomponentStrategy: 'parallel'
		};

		//------------------------------------ CONSTRUCTOR --------------------------------------//

		public constructor(...args: any[]) {
			super(...args); // Call parent constructor, passing any arguments
			this.msc_zh7y_options = { ...this.msc_zh7y_options, ...options }; // Merge options with defaults
			this.msc_zh7y_unshadowPrefix = unshadowPrefix; // Set the unshadow prefix for internal members
		}		

		//------------------------------------- PUBLIC API --------------------------------------//
		
		/** Observable stream of state changes for the component and its subcomponents (if any)
		 * @returns Observable that emits the current state of the component and its subcomponents (if any) whenever the state changes
		 * @remark The observable is a BehaviorSubject, so it will emit the current state immediately upon subscription
		 * @remark The observable will emit the aggregated state if subcomponents are present, otherwise it will emit the component's own state
		 */
		public readonly state$: Observable<ComponentStateInfo> = this. msc_zh7y_stateSubject.asObservable();
		
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
			if (this. msc_zh7y_stateSubject.value.state !== ComponentState.UNINITIALIZED) {
				return Promise.resolve();
			}
		
			// If initialization is already in progress, return the existing promise
			if (this.msc_zh7y_initializationPromise) {
				return this.msc_zh7y_initializationPromise;
			}			
			
			// Create a new initialization promise
			this.msc_zh7y_initializationPromise = new Promise<void>(async (resolve, reject) => {
				try {
					// Set own state and update the state subject with the new state
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.INITIALIZING,
						reason: 'Component initialization in progress',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed

					// Call parent initialize method if found (preserving inheritance)
					await this[`${unshadowPrefix}callParentMethod`](this.initialize, ...args);

					// Initialize main component and any subcomponents in the order specified in options
					if (this.msc_zh7y_options.initializationStrategy === 'parent-first') {
						await this.onInitialize();
						await this[`${unshadowPrefix}initializeSubcomponents`]();
					} else { // 'children-first'
						await this[`${unshadowPrefix}initializeSubcomponents`]();
						await this.onInitialize();
					}
					
					// Set own state and update the state subject with the new state
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.OK,
						reason: 'Component initialized successfully',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed

					resolve();
				} 
				catch (error) {
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component initialization failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed
										
					reject(error);
				}
				finally {
					this.msc_zh7y_initializationPromise = undefined;
				}
			});
		
			return this.msc_zh7y_initializationPromise;
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
				if (this. msc_zh7y_stateSubject.value.state === ComponentState.UNINITIALIZED) {
					await this.initialize();
				}
				
				const isThisComponentReady = 
					this. msc_zh7y_stateSubject.value.state === ComponentState.OK || 
					this. msc_zh7y_stateSubject.value.state === ComponentState.DEGRADED;
				
				// If no subcomponents or this component isn't ready, return the result
				if (!this. msc_zh7y_subcomponents.length || !isThisComponentReady) {
					return isThisComponentReady;
				}
				
				// Check if all subcomponents are ready
				const subcomponentReadyStates = await Promise.all(
					this. msc_zh7y_subcomponents.map(async component => {
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
			if (this. msc_zh7y_stateSubject.value.state === ComponentState.SHUT_DOWN) {
				return Promise.resolve();
			}

			// If shutdown is already in progress, return the existing promise
			if (this.msc_zh7y_shutdownPromise) {
				return this.msc_zh7y_shutdownPromise;
			}

			this.msc_zh7y_shutdownPromise = new Promise<void>(async (resolve, reject) => {
				try {
					// Set own state and update the state subject with the new state
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.SHUTTING_DOWN,
						reason: 'Component shutdown in progress',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed

					// Call parent shutdown method if found (preserving inheritance)
					await this[`${unshadowPrefix}callParentMethod`](this.shutdown, ...args);

					// Shut down main component and any subcomponents in the order specified in options
					if (this.msc_zh7y_options.shutDownStrategy === 'parent-first') {
						await this.onShutdown();
						await this[`${unshadowPrefix}shutdownSubcomponents`];
					} else { // 'children-first'
						await this[`${unshadowPrefix}shutdownSubcomponents`];
						await this.onShutdown();
					}

					// Set own state and update the state subject with the new state
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.SHUT_DOWN,
						reason: 'Component shut down successfully',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed
					
					resolve();
				} 
				catch (error) {
					// Update state to indicate shutdown failure
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed
					
					reject(error);
				}
				finally {
					this.msc_zh7y_shutdownPromise = undefined;
				}
			});

			return this.msc_zh7y_shutdownPromise;
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
		/* @internal */ onInitialize(): Promise<void> { return Promise.resolve(); }
		
		/** Execute component-specific shutdown
		 * @returns Promise that resolves when shutdown is complete
		 * @throws Error if shutdown fails
		 * @remark This method can be overridden by subclasses that have specific shutdown needs.
		 * @remark It is called from `shutdown()` and should contain the component-specific logic for shutdown.
		 * @remark It should leave it to shutdown() to handle the state management and observable emissions.
		 * @remark A default implementation is provided that simply resolves the promise.
		 */
		/* @internal */ onShutdown(): Promise<void> { return Promise.resolve(); }

		//--------------------------------- PROTECTED METHODS -----------------------------------//
		
		// NOTE: TS does not support protected members in abstract classes, so we use public with @internal tag
		
		/* Calculate the current aggregated component state */
		/* @internal */ [`${unshadowPrefix}calculateState`](): ComponentStateInfo {
			// If no subcomponents, just return the current state
			if (this.msc_zh7y_subcomponents.length === 0) {
				return { ...this.msc_zh7y_stateSubject.value };
			}
			
			// Get all component states - include own state directly rather than from stateSubject
			const states = [
				{ ...this.msc_zh7y_ownState }, // Use ownState instead of stateSubject value
				...this.msc_zh7y_subcomponents.map((c: any) => c[`${unshadowPrefix}calculateState`]())
			];
			
			// Calculate worst state
			const worstState = this[`${unshadowPrefix}calculateWorstState`](states);
			
			// Return the aggregated state without updating the subject
			return {
				name: this.constructor.name,
				state: worstState.state,
				reason: this[`${unshadowPrefix}createAggregatedReason`](states, worstState),
				updatedOn: new Date(),
				components: this.msc_zh7y_subcomponents.map((c: any) => c[`${unshadowPrefix}calculateState`]())
			};
		}
		
		/* Call parent method shadowed by this mixin
		 * @param method The method to call in the parent class hierarchy
		 * @returns The result of the parent method call, or undefined if not found
		 * @throws Error if the method is not found in the parent class hierarchy
		 */
		/* @internal */ async [`${unshadowPrefix}callParentMethod`](method: Function, ...args: any[]): Promise<any> {
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
		/* @internal */ [`${unshadowPrefix}calculateWorstState`](states: ComponentStateInfo[]): ComponentStateInfo {
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
		/* @internal */ [`${unshadowPrefix}createAggregatedReason`](states: ComponentStateInfo[], worstState: ComponentStateInfo): string {
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
		/* @internal */ [`${unshadowPrefix}findParentMethodOf`](method: Function): Function | undefined {
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
		/* @internal */ async [`${unshadowPrefix}initializeSubcomponents`](): Promise<void> {
			if (this. msc_zh7y_subcomponents.length === 0) return;
			
			if (this.msc_zh7y_options.subcomponentStrategy === 'parallel') { // fastest				
				await Promise.all(this. msc_zh7y_subcomponents.map(component => component.initialize()));
			}
			else { // sequential, slower but guaranteed to respect registration order
				for (const component of this. msc_zh7y_subcomponents) {
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
		/* @internal */ [`${unshadowPrefix}registerSubcomponent`](component: ManagedStatefulComponent): void {
			if (!component) {
				throw new Error('Component cannot be null or undefined');
			}
			else if (!(component instanceof ManagedStatefulComponentClass)) {
				throw new Error('Component must be an instance of ManagedStatefulComponent');
			}
			else if (this. msc_zh7y_subcomponents.includes(component)) {
				throw new Error('Component is already registered as a subcomponent');
			}
			
			this. msc_zh7y_subcomponents.push(component);
			
			// Subscribe to component state changes
			const subscription = component.state$.subscribe(state => {
				// Update the aggregated state when a subcomponent's state changes
				this[`${unshadowPrefix}updateAggregatedState`]();
			});
			
			this.msc_zh7y_componentSubscriptions.set(component, subscription);
			
			// Update the aggregated state to include the new component
			this[`${unshadowPrefix}updateAggregatedState`]();
		}

		/* Shut down subcomponents
		 * @returns Promise that resolves when all subcomponents are shut down
		 * @throws Error if shutdown fails
		 * @remark defaults to parallel shutdown
		 * @remark Sequential shutdown is slower but guarantees that subcomponents are shut down in the reverse order they were registered
		 */
		/* @internal */ async [`${unshadowPrefix}shutdownSubcomponents`](): Promise<void> {
			if (this. msc_zh7y_subcomponents.length === 0) return;
			
			if (this.msc_zh7y_options.subcomponentStrategy === 'parallel') { // fastest
				await Promise.all(this. msc_zh7y_subcomponents.map(component => component.shutdown()));
			}
			else { // sequential, slower but guaranteed to respect registration order
				for (const component of this. msc_zh7y_subcomponents.reverse()) {
					await component.shutdown();
				}
			}
		}
		
		/* DEPRECATED Update state when registering ir unregistering subcomponents
		 * @returns void
		 * @remark New code should possibly not rely on this method
		 * @todo Remove this method in future versions
		 */
		/* @internal */ [`${unshadowPrefix}updateAggregatedState`](): void {
			if (this.msc_zh7y_subcomponents.length === 0) {
				return; // Nothing to aggregate
			}
			
			// Calculate the aggregated state
			const aggregatedState = this[`${unshadowPrefix}calculateState`]();
			
			// Update the state subject directly (no partial updates to merge)
			this.msc_zh7y_stateSubject.next(aggregatedState);
		}

		/* Update the state of the component and optionally its subcomponents
		 * @param state The new state to set
		 * @returns Promise that resolves when the state update has fully propagated
		 * @remark Waits for state change to propagate before resolving (i.e. "Wait for Your Own Events" pattern to ensure consistency)
		 */
		/* @internal */ async [`${unshadowPrefix}updateState`](newState: Partial<ComponentStateInfo>): Promise<void> {
			// Create base updated state by merging with current state
			let baseState: ComponentStateInfo = {
				...this.msc_zh7y_stateSubject.value,
				...newState,
				updatedOn: new Date()
			};
			
			// For components with subcomponents, recalculate the aggregated state
			let updatedState: ComponentStateInfo;			
			if (this.msc_zh7y_subcomponents.length > 0) {
				// Update own state with new values
				this.msc_zh7y_ownState = {
					...this.msc_zh7y_ownState,
					...newState,
					updatedOn: new Date()
				};
				
				// Calculate the full aggregated state (will include subcomponents)
				updatedState = this[`${unshadowPrefix}calculateState`]();
			} else {
				// No subcomponents, just use the merged state
				updatedState = baseState;
			}
			
			// Create a promise that resolves when this state change is observed
			const updateStatePromise = firstValueFrom(
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
			this. msc_zh7y_stateSubject.next(updatedState);
			
			// Wait for state update to propagate through the observable chain
			await updateStatePromise;

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
		/* @internal */ [`${unshadowPrefix}unregisterSubcomponent`](component: ManagedStatefulComponent): boolean {
			const index = this. msc_zh7y_subcomponents.indexOf(component);
			if (index === -1) {
				return false;
			}
			
			// Clean up subscription
			const subscription = this.msc_zh7y_componentSubscriptions.get(component);
			if (subscription) {
				subscription.unsubscribe();
				this.msc_zh7y_componentSubscriptions.delete(component);
			}
			
			// Remove component
			this. msc_zh7y_subcomponents.splice(index, 1);
			
			// Update the aggregated state
			this[`${unshadowPrefix}updateAggregatedState`]();
			
			return true;
		}
	}
	
	return ManagedStatefulComponentClass;
}
export default ManagedStatefulComponentMixin;