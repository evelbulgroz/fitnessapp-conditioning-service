import { Observable, Subscription } from 'rxjs';

import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponent from '../models/managed-stateful-component';

/** A mixin that adds support for aggregated state management across multiple subcomponents.
 * @param Parent The immediate parent class - must implement ManagedStatefulComponent interface
 * @typeparam TParent The type of the parent class
 * @returns A class that extends the provided parent and adds aggregated state management
 * @remark This mixin is designed to work with classes that already use ManagedStatefulComponentMixin and adds functionality to manage subcomponents.
 * @see ManagedStatefulComponentMixin
 * @remark Anonymous classes in TypeScript cannot have non-public members. Instead, members not intended for the public API are marked as `@internal`.
 * - It is up to clients to respect this convention, as it is not enforced by TypeScript.
 * 
 * USAGE:
 * @example
 * ```typescript
 * // Single inheritance with no parent
 * class AppHealth extends CompositeStatefulComponentMixin(
 *   ManagedStatefulComponentMixin(class {})
 * ) {
 *   // Implementation
 * }
 * 
 * // With existing class hierarchy
 * class ModuleHealth extends CompositeStatefulComponentMixin(
 *   ManagedStatefulComponentMixin(BaseModule)
 * ) {
 *   // Implementation
 * }
 * ```
 * 
 * LOGGING:
 * * This mixin intentionally does not include logging functionality to maintain
 * a clean separation of concerns. To add logging, subscribe to the component's
 * state$ observable in your implementation, e.g. in the constructor of your class.
 * 
 * @example
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(class {}) {
 *   constructor(private logger: Logger) {
 *     super();
 *     
 *     // Set up logging for state changes
 *     this.state$.subscribe(state => {
 *       this.logger.log(
 *         `State changed to ${state.state}: ${state.reason}`,
 *         this.constructor.name
 *       );
 *     });
 *   }
 *   
 *   protected async executeInitialization(): Promise<void> {
 *     // Component initialization logic
 *   }
 *   
 *   protected async executeShutdown(): Promise<void> {
 *     // Component shutdown logic
 *   }
 * }
 * ```
 */
export function CompositeStatefulComponentMixin<
  TParent extends new (...args: any[]) => ManagedStatefulComponent
>(Parent: TParent) {
  abstract class CompositeStatefulComponentClass extends Parent {

		//-------------------------------------- PROPERTIES -------------------------------------//

		/** The subcomponents managed by this composite component */
		public /* @internal */ subcomponents: ManagedStatefulComponent[] = [];
		
		/** Subscriptions to subcomponent state changes */
		public /* @internal */ componentSubscriptions: Map<ManagedStatefulComponent, Subscription> = new Map();

		//-------------------------------------- PUBLIC API -------------------------------------//
		
		/** Override getState to include subcomponent information */
		public override getState(): ComponentStateInfo {
			const baseState = super.getState();
			
			// If we have subcomponents, include their states
			if (this.subcomponents.length > 0) {
				return {
					...baseState,
					components: this.subcomponents.map(c => c.getState())
				};
			}
			
			return baseState;
		}
		
		/** Initialize this component and all its subcomponents
		 * @returns Promise that resolves when all components are initialized
		 * @throws Error if initialization of any component fails
		 * @override Overrides the base initialize method to also initialize subcomponents
		 */
		public override async initialize(): Promise<void> {
			// First initialize this component using parent's implementation
			await super.initialize();
			
			// Then initialize all subcomponents in parallel
			const initPromises = this.subcomponents.map(component => component.initialize());
			
			try {
				await Promise.all(initPromises);
				
				// Update the aggregated state one final time
				this.updateAggregatedState();
			}
			catch (error) {
				// Update state to reflect failure - important to capture the failure state
				this.updateAggregatedState();
				
				// Re-throw the error for the consumer to handle
				throw error;
			}
		}
		
		/** Shutdown this component and all its subcomponents
		 * @returns Promise that resolves when all components are shut down
		 * @throws Error if shutdown of any component fails
		 * @override Overrides the base shutdown method to also shutdown subcomponents
		 */
		public override async shutdown(): Promise<void> {
			// Clean up all subscriptions
			for (const subscription of this.componentSubscriptions.values()) {
				subscription.unsubscribe();
			}
			this.componentSubscriptions.clear();
			
			// Collect errors during shutdown but don't fail immediately
			const errors: Error[] = [];
			
			// Shut down all subcomponents in parallel
			const shutdownPromises = this.subcomponents.map(async component => {
				try {
					await component.shutdown();
				} catch (error) {
					errors.push(error instanceof Error ? error : new Error(String(error)));
				}
			});
			
			// Wait for all shutdown attempts to complete
			await Promise.all(shutdownPromises);
			
			// Then shut down this component using parent's implementation
			await super.shutdown();
			
			// If any subcomponents failed to shut down, throw an aggregate error
			if (errors.length > 0) {
				throw new AggregateError(
					errors, 
					`Failed to shut down ${errors.length} subcomponent(s)`
				);
			}
		}
		
		/** Check if this component and all its subcomponents are ready
		 * @returns Promise that resolves to true if all components are ready, false otherwise
		 * @override Overrides the base isReady method to also check subcomponents
		 */
		public override async isReady(): Promise<boolean> {
			// First check if this component is ready using parent's implementation
			const isThisReady = await super.isReady();
			if (!isThisReady) {
				return false;
			}
			
			// Then check if all subcomponents are ready
			const readyPromises = this.subcomponents.map(component => component.isReady());
			
			try {
				const results = await Promise.all(readyPromises);
				return results.every(result => result === true);
			}
			catch (error) {
				// If checking readiness fails, component is not ready
				return false;
			}
		}
		
		//---------------------------------- PROTECTED METHODS ----------------------------------//

		// NOTE: Anonymous classes in TypeScript cannot have non-public members.
		  // Instead, these members are marked `@internal` to clarify that they
		  // are not intended as part of the public API.
		
		/** Register a subcomponent to be managed by this composite component
		 * @param component The subcomponent to register
		 * @param name Optional name for the subcomponent (defaults to component's constructor name)
		 * @returns The registered component (for method chaining)
		 */
		public /* @internal */ registerSubcomponent<T extends ManagedStatefulComponent>(
			component: T, 
			name?: string
		): T {
			if (!component) {
				throw new Error('Cannot register null or undefined subcomponent');
			}
			
			// Add to tracked subcomponents
			this.subcomponents.push(component);
			
			// Subscribe to state changes and store the subscription
			const subscription = component.state$.subscribe(state => {
				// Update aggregated state
				this.updateAggregatedState();
			});
			
			this.componentSubscriptions.set(component, subscription);
			
			// Update aggregated state immediately
			this.updateAggregatedState();
			
			return component;
		}
		
		/** Unregister a subcomponent
		 * @param component The subcomponent to unregister
		 * @returns true if the component was removed, false if it wasn't found
		 */
		public /* @internal */ unregisterSubcomponent(component: ManagedStatefulComponent): boolean {
			const index = this.subcomponents.indexOf(component);
			if (index !== -1) {
				// Remove from subcomponents array
				this.subcomponents.splice(index, 1);
				
				// Unsubscribe from state changes
				const subscription = this.componentSubscriptions.get(component);
				if (subscription) {
					subscription.unsubscribe();
					this.componentSubscriptions.delete(component);
				}
				
				// Update aggregated state
				this.updateAggregatedState();
				return true;
			}
			return false;
		}
		
		/** Get all registered subcomponents
		 * @returns Array of registered subcomponents
		 */
		public /* @internal */ getSubcomponents(): ReadonlyArray<ManagedStatefulComponent> {
			return [...this.subcomponents];
		}
		
		/** Update the aggregated state based on all subcomponent states
		 * @private
		 */
		public /* @internal */ updateAggregatedState(): void {
			// Get all states to consider
			const states = [
				super.getState(),	// This component's state
				...this.subcomponents.map(c => c.getState()) // All subcomponent states
			];
			
			// Determine the worst state
			const worstState = this.calculateWorstState(states);

			// Update component's state to reflect the aggregated state
			(this as any).stateSubject.next({ // compiler workaround for inherited stateSubject
				name: this.constructor.name,
				state: worstState.state,
				reason: this.createAggregatedReason(states, worstState),
				updatedOn: new Date(),
				components: this.subcomponents.map(c => c.getState())
			});
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
	
	return CompositeStatefulComponentClass;
}

export default CompositeStatefulComponentMixin;