import ComponentContainer from "./component-container.model";
import ManageableComponent from "./manageable-component.model";
import StatefulComponent from "./stateful-component.model";

/**
 * Interface for components with both lifecycle management and state tracking capabilities.
 * 
 * @remark Combines lifecycle management (initialize/shutdown) and observable health state tracking.
 * @remark Components implementing this interface can be managed and monitored by health check services.
 * @remark Lifecycle methods should update the observable state.
 */
export type ManagedStatefulComponent = ManageableComponent & StatefulComponent & ComponentContainer;
export default ManagedStatefulComponent;
