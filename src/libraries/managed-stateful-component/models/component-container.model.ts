import ManagedStatefulComponent from "./managed-stateful-component.model";

/**
 * Interface for components that can contain and manage other components
 * 
 * @remark Defines methods for registering and unregistering subcomponents
 * @remark Component containers are responsible for management and state aggregation of subcomponents
 */
export interface ComponentContainer {
	/**
	 * Register a subcomponent to be managed by this component
	 * 
	 * @param component The subcomponent to register
	 * @returns void
	 * @throws Error if the component is null, undefined, or already registered
	 * 
	 * @remark This method is intended for internal use and should not be called directly by clients.
	 * @remark It is used to manage the lifecycle of subcomponents and ensure they are properly initialized and shut down.
	 * @remark The component must be an instance of ManagedStatefulComponent.
	 * 
	 * @required by {@link ComponentContainer} interface
	 */
	registerSubcomponent(component: ManagedStatefulComponent): boolean;

	/**
	 * Unregister a subcomponent from this component
	 * 
	 * @param component The subcomponent to unregister
	 * @returns true if the component was successfully unregistered, false otherwise
	 * @throws Error if the component is null or undefined
	 * 
	 * @remark This method is intended for internal use and should not be called directly by clients.
	 * @remark It is used to manage the lifecycle of subcomponents and ensure they are properly initialized and shut down.
	 * @remark The component must be an instance of ManagedStatefulComponent.
	 * 
	 * @required by {@link ComponentContainer} interface
	 */
	unregisterSubcomponent(component: ManagedStatefulComponent): boolean
}

export default ComponentContainer;