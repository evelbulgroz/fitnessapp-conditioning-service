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
	 * Observable stream of the component's state changes.
	 * 
	 * @returns Observable that emits when the component's state changes.
	 * @remark Subscribers should receive a consistent view of the component's state transitions.
	 */
	componentState$: Observable<ComponentStateInfo>;
}

export default StatefulComponent;