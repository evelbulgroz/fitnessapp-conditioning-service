/** Interface for any manageable application component.
 * @remark This is used by this service to track the lifecycle of the application and its components.
 * @remark Components must implement this interface to be managed by the health check service.
 */

export interface ManageableComponent {
	/** Initializes the component if it is not already initialized.
	 * @returns Promise that resolves to void if the component was initialized, rejects with error if initialization fails.
	 * @remark The component should respond gracefully to concurrent requests for initialization.
	 * @remark The component should be in the INITIALIZED state after this method is called.
	 */
	initialize(): Promise<void>;

	/** Check if the service is ready to serve requests
	 * @returns true if the component is ready to serve requests, false otherwise.
	 * @remark The component should be in the OK, or possibly DEGRADED, state to be considered ready.
	 * @remark Any other state should be considered not ready.
	 * @remark This is used by the health check service to determine if the application is lively, and/or healthy, and ready to serve requests.
	 */
	isReady(): Promise<boolean>;

	/** Shuts down the component and cleans up any resources it is using.
	 * @returns Promise that resolves to void if the component was shut down, rejects with error if shutdown fails.
	 * @remark The component should respond gracefully to concurrent requests for shutdown.
	 * @remark The component should be in the SHUTDOWN state after this method is called.
	 */
	shutdown(): Promise<void>;
}

export default ManageableComponent;