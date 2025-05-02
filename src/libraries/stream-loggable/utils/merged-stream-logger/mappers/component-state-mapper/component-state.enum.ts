/** Specifies supported component states with respect to readiness to serve requests.
 * @remark This interface is only provided for demonstration purposes.
 * @remark To avoid external dependencies, it is not exported from this library.
 */
export enum ComponentStateDemo {
	/** The component is uninitialized. */
	UNINITIALIZED = 'UNINITIALIZED',

	/** The component is initializing. */
	INITIALIZING = 'INITIALIZING',

	/** The component is fully operational. */
	OK = 'OK',

	/** The component is operational but degraded. */
	DEGRADED = 'DEGRADED',

	/** The component is temporarily unavailable. */
	UNAVAILABLE = 'UNAVAILABLE',

	/** The component has encountered an unrecoverable error. */
	/** @remarks This is a terminal state and the component should be shut down and/or destroyed. */
	FAILED = 'FAILED',

	/** The component is shutting down. */
	SHUTTING_DOWN = 'SHUTTING_DOWN',

	/** The component has been shut down. */
	SHUT_DOWN = 'SHUT_DOWN'
}

export default ComponentStateDemo;