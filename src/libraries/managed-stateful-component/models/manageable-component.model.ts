/**
 * Interface for components with lifecycle management capabilities.
 * 
 * @remark Represents components that can be initialized, checked for readiness, and shut down.
 * @remark Lifecycle events should update the component's state.
 * @remark Implementation should handle concurrent calls gracefully.
 * 
 */
export interface ManageableComponent {
	/**
	 * Initialize the component and all of its subcomponents (if any) if it is not already initialized
	 * 
	 * @param args Optional arguments to pass to parent initialize methods 
	 * @returns Promise that resolves when the component and all of its subcomponents are initialized
	 * @throws Error if initialization fails
	 * 
	 * @remark Executes any inherited initialize() method before executing subclass initialize() logic
	 * @remark Subclasses may optionally override `onInitialize()` to provide component-specific initialization logic
	 * @remark Transitions state to `INITIALIZING` during the process and to `OK` when complete
	 * @remark Handles concurrent calls by returning the same promise for all callers during initialization
	 * @remark If the component is already initialized, resolves immediately
	 * @remark Required by {@link ManageableComponent} interface
	 */
	initialize(...args: any[]): Promise<void>;

	/**
	 * Check if the component, including any subcomponents, is ready to serve requests
	 * 
	 * @returns Promise that resolves to true if ready, false otherwise
	 * @throws Error if the component or any of its subcomponents is not ready
	 * 
	 * @remark Ignores any inherited isReady() method, as isReady() is considered purely informational
	 * @remark May trigger initialization if the component supports lazy initialization
	 * @remark A component is typically ready when it and all of its subcomponents are in the `OK` or `DEGRADED` componentState$
	 * @remark Required by {@link ManageableComponent} interface
	 */
	isReady(): Promise<boolean>;

	/**
	 * Shut down the component and all of its subcomponents (if any) if it is not already shut down
	 * 
	 * @param args Optional arguments to pass to parent shutdown methods
	 * @returns Promise that resolves when the component and all of its subcomponents are shut down
	 * @throws Error if shutdown fails
	 * 
	 * @remark Executes any inherited shutdown() method before executing subclass shutdown() logic
	 * @remark Subclasses may optionally override `onShutdown()` to provide component-specific shutdown logic
	 * @remark Transitions state to `SHUTTING_DOWN` during the process and to `SHUT_DOWN` when complete
	 * @remark Handles concurrent calls by returning the same promise for all callers during shutdown
	 * @remark If the component is already shut down, resolves immediately
	 * @remark Required by {@link ManageableComponent} interface
	 */
	shutdown(...args: any[]): Promise<void>;
}

export default ManageableComponent;