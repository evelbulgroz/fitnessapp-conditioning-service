import { Observable } from "rxjs";
import { ComponentStateInfo } from "./component-state-info";

/** Interface for any application component that tracks its own state with respect to readiness to serve requests.
 * @remark This is used by this service to track the lifecycle of the application and its components.
 * @remark Components must implement this interface to be monitored by the health check service.
 */

export interface StatefulComponent {
	/** Stream of the component's state changes.
	 * @returns Observable that emits the component's state changes.
	 */
	state$: Observable<ComponentStateInfo>;

	/** The current lifecycle status of the component.
	 * @returns The current lifecycle status of the component (immutable).
	 */
	getState(): ComponentStateInfo;
}

export default StatefulComponent;