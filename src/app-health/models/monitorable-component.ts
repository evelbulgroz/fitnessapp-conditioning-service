import { ManageableComponent } from "./manageable-component";
import { StatefulComponent } from "./stateful-component";

/** Interface for any application component that is both manageable and tracks its own state with respect to readiness to serve requests.
 * @remark This is used by the app health service to track the lifecycle of the application and its components.
 * @remark Components must implement this interface to be monitored by the health check service.
 */

export type MonitorableComponent = ManageableComponent & StatefulComponent;
export default MonitorableComponent;
