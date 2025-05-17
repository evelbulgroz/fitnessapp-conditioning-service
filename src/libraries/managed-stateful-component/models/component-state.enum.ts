/**
 * Specifies supported component states with respect to readiness to serve requests.
 * 
 * @remarks The state should default to UNINITIALIZED when the component is created, and updated as needed
 * @remarks State INITIALIZING may also be used to prevent multiple, overlapping initializations
 * @remarks State SHUTTING_DOWN may also be used to prevent multiple, overlapping shutdowns
 * @remarks Any class implementing {@link ManagedStatefulComponent} can use this to track its state, e.g. a service, controller.
 *
 */
export enum ComponentState {
	/**
	 * The component is uninitialized.
	 */
	UNINITIALIZED = 'UNINITIALIZED',

	/**
	 * The component is initializing.
	 */
	INITIALIZING = 'INITIALIZING',

	/**
	 * The component is fully operational.
	 */
	OK = 'OK',

	/**
	 * The component is operational but degraded.
	 */
	DEGRADED = 'DEGRADED',

	/**
	 * The component is temporarily unavailable.
	 */
	UNAVAILABLE = 'UNAVAILABLE',

	/**
	 * The component has encountered an unrecoverable error.
	 * 
	 * @remark This is a terminal state and the component should be shut down and/or destroyed.
	 *
	 */
	FAILED = 'FAILED',

	/**
	 * The component is shutting down.
	 */
	SHUTTING_DOWN = 'SHUTTING_DOWN',

	/**
	 * The component has been shut down.
	 */
	SHUT_DOWN = 'SHUT_DOWN'
}

export default ComponentState;