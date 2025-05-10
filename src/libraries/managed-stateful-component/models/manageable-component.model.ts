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
	 * Initialize the component if it is not already initialized.
	 * 
	 * @returns Promise that resolves when initialization is complete, rejects if initialization fails.
	 * @remark Should handle concurrent calls by returning the same promise for all callers during initialization.
	 * @remark Should transition state to INITIALIZING during the process and to OK when complete.
	 * 
	 */
	initialize(): Promise<void>;

	/**
	 * Check if the component is ready to process requests.
	 * 
	 * @returns Promise resolving to true if ready to serve requests, false otherwise.
	 * @remark May trigger initialization if the component supports lazy initialization.
	 * @remark A component is typically ready when in OK or DEGRADED state.
	 * 
	 */
	isReady(): Promise<boolean>;

	/**
	 * Gracefully  down the component and releases resources.
	 * 
	 * @returns Promise that resolves when shutdown is complete, rejects if shutdown fails.
	 * @remark Should handle concurrent calls by returning the same promise for all callers during shutdown.
	 * @remark Should transition state to SHUTTING_DOWN during the process and to SHUT_DOWN when complete.
	 * 
	 */
	shutdown(): Promise<void>;
}

export default ManageableComponent;