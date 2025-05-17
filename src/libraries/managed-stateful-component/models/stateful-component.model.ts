import { Observable } from "rxjs";

import ComponentStateInfo from "./component-state-info.model";

/**
 * Interface for observable component health state tracking.
 * 
 * @remark Provides access to the current health state and a stream of state changes.
 * @remark Allows external systems to monitor component health without tight coupling.
 */
export interface StatefulComponent {
	/**
	 * Observable stream of state changes for the component and its subcomponents (if any).
	 * 
	 * @returns Observable that emits the current state of the component and its subcomponents (if any) whenever the state changes.
	 * @remark The observable is a BehaviorSubject, so it will emit the current state immediately upon subscription.
	 * @remark The observable will emit the aggregated state if subcomponents are present, otherwise it will emit the component's own componentState$.
	 * @remark required by {@link StatefulComponent} interface.
	 * 
	 */
	componentState$: Observable<ComponentStateInfo>;

	/**
	 * Get the current component state as a snapshot.
	 * 
	 * @returns Promise that resolves to the current state of the component.
	 * @throws Never - this method does not throw exceptions.
	 * 
	 * @remark This is a convenience method for getting the current state without subscribing to componentState$.
	 * @remark For continuous state updates, use componentState$ observable instead.
	 * @remark For health checks and diagnostics, this method is preferred over subscribing to componentState$.
	 * @remark required by {@link StatefulComponent} interface.
	 * 
	 */
	getState(): Promise<ComponentStateInfo>;

	/**
	 * Serialize the component and its subcomponents to a JSON-friendly structure.
	 * 
	 * @remark Includes constructor name, own state, aggregated state, and subcomponent hierarchy states.
	 * @remark Intended for use in debuggin, diagnostics and health checks.
	 * @remark required by {@link StatefulComponent} interface.
	 */
	toJSON(): Record<string, any>;

	/**
	 * Update the state of the component with the specified state information.
	 * 
	 * @param newState New state information to set, optionally partial.
	 * @returns Promise that resolves when the state update has fully propagated.
	 * 
	 * @remark State changes are aggregated with subcomponent states.
	 * @remark The method waits for state change to propagate before resolving.
	 * @remark required by {@link StatefulComponent} interface.
	 */
	updateState(newState: Partial<ComponentStateInfo>): Promise<void>;	
}

export default StatefulComponent;