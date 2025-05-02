import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import ComponentState from '../models/component-state.enum';
import ComponentStateInfo from '../models/component-state-info.model';
import ManagedStatefulComponent from '../models/managed-stateful-component.model';
import ManagedStatefulComponentOptions from '../models/managed-stateful-component-options.model';

// Fixed prefix for internal members to avoid name collisions with parent classes or other libraries.
 // Applied dynamically to all internal methods, and is hard coded into property names for simplicity.
const MSC_PREFIX = 'msc_zh7y_';

/** A mixin that provides a standard implementation of the {@link ManagedStatefulComponent} interface.
 * This mixin follows the stateful component pattern for lifecycle management with built-in
 * state tracking, hierarchical composition, and standardized initialization/shutdown flows.
 * 
 * @param Parent The immediate parent class to extend, or `class {}` if no inheritance is needed
 * @typeparam TParent The type of the parent class
 * @param options Configuration options for initialization, shutdown, and subcomponent strategies
 * @param unshadowPrefix Prefix for internal methods to avoid name collisions. Defaults to MSC_PREFIX. Leave as is in most cases.
 * @returns A class that implements {@link ManagedStatefulComponent} and extends the provided parent
 * @todo If/when TypeScript supports it, add a decorator to apply this mixin to a class (see below).
 * 
 * @remark COMPONENT STATES
 * Components move through the following states:
 * - UNINITIALIZED → INITIALIZING → OK (normal flow)
 * - OK → DEGRADED (when partial functionality is compromised)
 * - OK/DEGRADED → SHUTTING_DOWN → SHUT_DOWN (normal shutdown)
 * - Any state → FAILED (on error)
 * 
 * @remark STATE MANAGEMENT
 * - Component's own state is tracked in `msc_zh7y_ownState`
 * - All internal properties use the fixed prefix `msc_zh7y_` to avoid name collisions
 * - Component state changes are observable through the `componentState$` Observable
 * - Aggregated state includes all subcomponents, with the "worst" state propagating upward
 * - The mixin uses the "Wait for Your Own Events" pattern to ensure state changes are propagated before resolving promises
 * 
 * @remark INHERITANCE BEHAVIOR
 * - Preserves inheritance chain and passes calls up through class hierarchy
 * - All members specified by {@link ManagedStatefulComponent} are reserved for the mixin:
 * 
 * {@link ManageableComponent} members:
 * - `initialize()` - Initializes the component and its subcomponents, passing calls up the hierarchy
 * - `shutdown()` - Shuts down the component and its subcomponents, passing calls up the hierarchy
 * - `isReady()` - Checks if component is ready to serve requests, shadows any parent method
 * - `onInitialize()` - Template method for component-specific initialization logic, called by `initialize()`, shadows any parent method
 * - `onShutdown()` - Template method for component-specific shutdown logic, called by `shutdown()`, shadows any parent method 
 * 
 * {@link StatefulComponent} members:
 * - `componentState$` - Observable that emits state changes, shadows any parent property
 * 
 * {@link ComponentContainer} members:
 * - `registerSubcomponent()` - Registers a subcomponent for lifecycle management and subscribes to its state changes
 *                            - Shadows any parent method
 * - `unregisterSubcomponent()` - Removes a subcomponent from management and unsubscribes from its state changes
 *                              - Shadows any parent method
 * 
 * Notes:
 * - Concrete classes may optionally override template methods `onInitialize()` and `onShutdown()`
 *   if they have specific initialization/shutdown needs
 * - The protected method prefix is configurable via the `unshadowPrefix` parameter, but should be left as is in most cases for compatibility
 * - The protected property prefix is hard coded to `msc_zh7y_` for simplicity
 * 
 * @remark COMPONENT HIERARCHY
 * - Parent-child relationships are supported via `registerSubcomponent()` and `unregisterSubcomponent()` methods
 * - State is automatically aggregated across the component hierarchy
 * - Initialization order is configurable in options (parent-first or children-first, default: parent-first)
 * - Shutdown order is configurable in options (parent-first or children-first, default: parent-first)
 * - Subcomponent operations are configurable in options (parallel or sequential, default: parallel)
 * 
 * @remark IMPLEMENTATION NOTES
 * - All asynchronous methods follow the async/await pattern
 * - Concurrent calls to initialization/shutdown methods share a promise
 * - State changes are observable and wait for propagation to complete
 * - TypeScript limitations: members intended to not be public are marked with @internal annotation, but are public in reality
 * 
 * @remark USAGE AND EXAMPLES
 * - Target class should extend the mixin to gain {@link ManagedStatefulComponent} functionality
 * - The mixin can be used with or without further inheritance, and with or without subcomponents
 *  
 * @example Basic component with no parent class:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(class {}) {
 *   public async onInitialize(): Promise<void> {
 *     // Initialize resources, open connections, etc.
 *   }
 *   
 *   public async onShutdown(): Promise<void> {
 *     // Release resources, close connections, etc.
 *   }
 * }
 * ```
 * 
 * @example Component with inheritance:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(ParentClass) {
 *   public async onInitialize(): Promise<void> {
 *     // Component-specific initialization logic
 *   }
 *   
 *   public async onShutdown(): Promise<void> {
 *     // Component-specific shutdown logic
 *   }
 * }
 * ```
 */
export function ManagedStatefulComponentMixin<TParent extends new (...args: any[]) => any>(
	Parent: TParent,
	options: ManagedStatefulComponentOptions = {
		initializationStrategy: 'parent-first',
		shutDownStrategy: 'parent-first',
		subcomponentStrategy: 'parallel'
	},
	unshadowPrefix: string = MSC_PREFIX
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
		 * @remark The observable will emit the aggregated state if subcomponents are present, otherwise it will emit the component's own componentState$
		 * @remark required by {@link StatefulComponent} interface
		 */
		public readonly componentState$: Observable<ComponentStateInfo> = this. msc_zh7y_stateSubject.asObservable();
		
		/** Initialize the component and all of its subcomponents (if any) if it is not already initialized
		 * @param args Optional arguments to pass to parent initialize methods 
		 * @returns Promise that resolves when the component and all of its subcomponents are initialized
		 * @throws Error if initialization fails
		 * @remark Executes any inherited initialize() method before executing subclass initialize() logic
		 * @remark Subclasses may optionally override `onInitialize()` to provide component-specific initialization logic
		 * @remark Transitions state to `INITIALIZING` during the process and to `OK` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during initialization
		 * @remark If the component is already initialized, resolves immediately
		 * @remark Required by {@link ManageableComponent} interface
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
					// Set own state and update the state subject with the new componentState$
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.INITIALIZING,
						reason: 'Component initialization in progress',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed

					// Call parent initialize method if found (preserving inheritance)
					const superResult = await this[`${unshadowPrefix}callParentMethod`](this.initialize, ...args);

					// Initialize main component and any subcomponents in the order specified in options
					if (this.msc_zh7y_options.initializationStrategy === 'parent-first') {
						await this.onInitialize(superResult);
						await this[`${unshadowPrefix}initializeSubcomponents`]();
					} else { // 'children-first'
						await this[`${unshadowPrefix}initializeSubcomponents`]();
						await this.onInitialize(superResult);
					}
					
					// Set own state and update the state subject with the new componentState$
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
		 * @remark A component is typically ready when it and all of its subcomponents are in the `OK` or `DEGRADED` componentState$
		 * @remark Required by {@link ManageableComponent} interface
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
		 * @remark Subclasses may optionally override `onShutdown()` to provide component-specific shutdown logic
		 * @remark Transitions state to `SHUTTING_DOWN` during the process and to `SHUT_DOWN` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during shutdown
		 * @remark If the component is already shut down, resolves immediately
		 * @remark Required by {@link ManageableComponent} interface
		 */
		public async shutdown(...args: any[]): Promise<any> {
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
					// Set own state and update the state subject with the new componentState$
					this. msc_zh7y_ownState = ({
						name: this.constructor.name,
						state: ComponentState.SHUTTING_DOWN,
						reason: 'Component shutdown in progress',
						updatedOn: new Date()
					});
					await this[`${unshadowPrefix}updateState`](this. msc_zh7y_ownState); // returns when state change is observed

					// Call parent shutdown method if found (preserving inheritance)
					const superResult = await this[`${unshadowPrefix}callParentMethod`](this.shutdown, ...args);

					// Shut down main component and any subcomponents in the order specified in options
					if (this.msc_zh7y_options.shutDownStrategy === 'parent-first') {
						await this.onShutdown(superResult);
						await this[`${unshadowPrefix}shutdownSubcomponents`];
					}
					else { // 'children-first'
						await this[`${unshadowPrefix}shutdownSubcomponents`];
						await this.onShutdown(superResult);
					}

					// Set own state and update the state subject with the new componentState$
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

		/** Register a subcomponent to be managed by this component
		 * @param component The subcomponent to register
		 * @returns void
		 * @throws Error if the component is null, undefined, or already registered
		 * @remark This method is intended for internal use and should not be called directly by clients.
		 * @remark It is used to manage the lifecycle of subcomponents and ensure they are properly initialized and shut down.
		 * @remark The component must be an instance of ManagedStatefulComponent.
		 * @required by {@link ComponentContainer} interface
		 */
		public registerSubcomponent(component: ManagedStatefulComponent): void {
			if (!component) {
				throw new Error('Component cannot be null or undefined');
			}
			else if (!(this[`${unshadowPrefix}isValidManagedComponent`](component))) {
				throw new Error('Component must be an instance of ManagedStatefulComponent');
			}
			else if (this. msc_zh7y_subcomponents.includes(component)) {
				throw new Error('Component is already registered as a subcomponent');
			}
			
			this. msc_zh7y_subcomponents.push(component);
			
			// Subscribe to component state changes
			const subscription = component.componentState$.subscribe(state => {
				// Update the aggregated state when a subcomponent's state changes
				this[`${unshadowPrefix}updateAggregatedState`]();
			});
			
			this.msc_zh7y_componentSubscriptions.set(component, subscription);
			
			// Update the aggregated state to include the new component
			this[`${unshadowPrefix}updateAggregatedState`]();
		}

		/** Unregister a subcomponent from this component
		 * @param component The subcomponent to unregister
		 * @returns true if the component was successfully unregistered, false otherwise
		 * @throws Error if the component is null or undefined
		 * @remark This method is intended for internal use and should not be called directly by clients.
		 * @remark It is used to manage the lifecycle of subcomponents and ensure they are properly initialized and shut down.
		 * @remark The component must be an instance of ManagedStatefulComponent.
		 * @required by {@link ComponentContainer} interface
		 */
		public unregisterSubcomponent(component: ManagedStatefulComponent): boolean {
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
			
			// Update the aggregated componentState$
			this[`${unshadowPrefix}updateAggregatedState`]();
			
			return true;
		}	
		//---------------------------------- TEMPLATE METHODS -----------------------------------//

		// NOTE: TS does not support protected members in abstract classes, so we use public with @internal tag

		/** Execute component-specific initialization
		 * @param args Result of parent class initialize() call (if any, passed in from initialize())
		 * @returns Promise that resolves when initialization is complete
		 * @throws Error if initialization fails
		 * @remark This method can be overridden by subclasses that have specific initialization needs.
		 * @remark It is called from `initialize()` and should contain the component-specific logic for initialization.
		 * @remark It should leave it to initialize() to handle the state management and observable emissions.
		 * @remark A default implementation is provided that simply resolves the promise.
		 */
		/* @internal */ onInitialize(...args: any[]): Promise<void> { void args; return Promise.resolve(); }
		
		/** Execute component-specific shutdown
		 * @param args Result of parent class shutdown() call (if any, passed in from shutdown())
		 * @returns Promise that resolves when shutdown is complete
		 * @throws Error if shutdown fails
		 * @remark This method can be overridden by subclasses that have specific shutdown needs.
		 * @remark It is called from `shutdown()` and should contain the component-specific logic for shutdown.
		 * @remark It should leave it to shutdown() to handle the state management and observable emissions.
		 * @remark A default implementation is provided that simply resolves the promise.
		 */
		/* @internal */ onShutdown(...args: any[]): Promise<void> { void args; return Promise.resolve(); }

		//--------------------------------- PROTECTED METHODS -----------------------------------//
		
		// NOTE: TS does not support protected members in abstract classes, so we use public with @internal tag
		
		/* Calculate the current aggregated component state */
		/* @internal */ [`${unshadowPrefix}calculateState`](): ComponentStateInfo {
			// If no subcomponents, just return the current componentState$
			if (this.msc_zh7y_subcomponents.length === 0) {
				return { ...this.msc_zh7y_stateSubject.value };
			}
			
			// Get all component states - include own state directly rather than from stateSubject
			const states = [
				{ ...this.msc_zh7y_ownState }, // Use ownState instead of stateSubject value
				...this.msc_zh7y_subcomponents.map((c: any) => c[`${unshadowPrefix}calculateState`]())
			];
			
			// Calculate worst componentState$
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
			
			// Find the highest priority (worst) componentState$
			let worstState: ComponentStateInfo | undefined;
			let worstPriority = -1;
			
			// Iterate through the states and find the one with the highest priority
			for (const state of states) {
				const priority = statePriority.indexOf(state.state);
				
				if (priority === -1) {
					// Track that we found an unknown componentState$
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
				
				// Get the priority of DEGRADED componentState$
				const degradedPriority = statePriority.indexOf(ComponentState.DEGRADED);
				
				// If DEGRADED is worse than the found worst state, return a DEGRADED componentState$
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
			// Count components in each componentState$
			const stateCounts: Record<string, number> = {};			
			states.forEach(state => {
				const stateValue = String(state.state);
				stateCounts[stateValue] = (stateCounts[stateValue] || 0) + 1;
			});
			
			// Create state summary string
			const stateSummary = Object.entries(stateCounts)
				.map(([state, count]) => `${state}: ${count}/${states.length}`)
				.join(', ');
			
			// Create detailed reason based on worst componentState$
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

		/* Check if the object is a valid managed component using duck typing
		 * @param obj The object to check
		 * @returns true if the object is a valid managed component, false otherwise
		 * @remark This method is used to check if the object is a valid managed component before registering it as a subcomponent
		 * @remark Using `instanceof` may fail because the module system may load different copies of the same class
		 */
		/* @internal */ [`${unshadowPrefix}isValidManagedComponent`](obj: any): boolean {
			return (
				// Check for required properties/methods
				typeof obj.initialize === 'function' &&
				typeof obj.shutdown === 'function' &&
				typeof obj.isReady === 'function' &&
				typeof obj.registerSubcomponent === 'function' &&
				typeof obj.unregisterSubcomponent === 'function' &&
				typeof obj.componentState$ !== 'undefined' &&
				obj.componentState$ instanceof Observable
			);
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
			
			// Calculate the aggregated componentState$
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
			// Create base updated state by merging with current componentState$
			let baseState: ComponentStateInfo = {
				...this.msc_zh7y_stateSubject.value,
				...newState,
				updatedOn: new Date()
			};

			// For components with subcomponents, recalculate the aggregated componentState$
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
				// No subcomponents, just use the merged componentState$
				updatedState = baseState;
			}
			
			// Create a promise that resolves when this state change is observed
			const updateStatePromise = firstValueFrom(
				this.componentState$.pipe(
					filter(state => 
						// Match on state value and timestamp to ensure we're waiting for this specific update
						state.state === updatedState.state && 
						state.updatedOn >= updatedState.updatedOn
					),
					take(1)
				)
			);
			
			// Update the componentState$
			this. msc_zh7y_stateSubject.next(updatedState);
			
			// Wait for state update to propagate through the observable chain
			await updateStatePromise;

			return void 0; // State update complete
		}
	}
	
	return ManagedStatefulComponentClass;
}
export default ManagedStatefulComponentMixin;

/* Decorator that applies the ManagedStatefulComponentMixin to a class to add managed state functionality.
 * @see {@link ManagedStatefulComponentMixin} for details on the mixin.
 * @param target The class to decorate (expects a constructor function).
 * @template T The type of the class to decorate
 * @returns The class with the mixin applied
 * @remark This decorator is a shorthand for applying the ManagedStatefulComponentMixin to a class.
 * @remark Any inheritance of the decorated class is preserved with no changes to the class hierarchy or 'extends' syntax.
 * @remark It may be useful to add {@link ManagedStatefulComponent} to the list of implemented interfaces in the decorated class.
 * @todo Enable this decorator when TypeScript supports it. Currently, it is commented out to avoid compilation errors.
 * 
 * @example
 * ```typescript
 * import { WithManagedState } from './with-managed-state.decorator';
 * 
 * @WithManagedState()
 * class MyComponent {
 * 	// Component logic here
 * }
 * ```
 * 
 */
/*
export function WithManagedState() {
	return function <T extends new (...args: any[]) => any>(target: T): T & (new (...args: any[]) => ManagedStatefulComponent) {
		return ManagedStatefulComponentMixin(target) as T & (new (...args: any[]) => ManagedStatefulComponent);
	};
}
export default WithManagedState;
*/