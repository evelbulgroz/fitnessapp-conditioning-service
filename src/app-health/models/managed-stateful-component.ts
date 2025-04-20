import { ManageableComponent } from "./manageable-component";
import { StatefulComponent } from "./stateful-component";

/** Interface for components with both lifecycle management and state tracking capabilities.
 * @remark Combines lifecycle management (initialize/shutdown) and observable health state tracking.
 * @remark Components implementing this interface can be managed and monitored by health check services.
 * @remark Lifecycle methods should update the observable state.
 */
export type ManagedStatefulComponent = ManageableComponent & StatefulComponent;
export default ManagedStatefulComponent;
