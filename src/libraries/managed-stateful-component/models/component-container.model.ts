import ManagedStatefulComponent from "./managed-stateful-component.model";

/** Interface for components that can contain and manage other components
 * @remark Defines methods for registering and unregistering subcomponents
 * @remark Component containers are responsible for management and state aggregation of subcomponents
 */
export interface ComponentContainer {
  /** Register a component to be managed by this container
   * @param component The component to register
   * @throws Error if the component is null, undefined, or already registered
   */
  registerSubcomponent(component: ManagedStatefulComponent): void;
  
  /** Unregister a component from this container
   * @param component The component to unregister
   * @returns true if the component was successfully unregistered, false otherwise
   * @throws Error if the component is null or undefined
   */
  unregisterSubcomponent(component: ManagedStatefulComponent): boolean;
}

export default ComponentContainer;