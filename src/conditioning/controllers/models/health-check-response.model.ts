import { ComponentStateInfo } from "src/libraries/managed-stateful-component";

/**
 * Response structure for basic health check endpoints like /healthz
 * 
 * @remark Simple health status response focused on core application state
 */
export interface HealthCheckResponse {
	/**
	 * Overall health status of the application
	 * @remarks Standardized to use up/down consistently
	 */
	status: 'up' | 'down';
	
	/**
	 * Information about healthy components
	 */
	info: {
		/**
		 * Application core health info
		 */
		app: {
			/**
			 * Status indicator
			 */
			status: 'up' | 'down';
			
			/**
			 * Detailed application state from ComponentState enum
			 */
			state: ComponentStateInfo;
		};
	};
	
	/**
	 * Error information (only present when status is 'down')
	 */
	error?: {
		/**
		 * Error description
		 */
		error: string;
	};
	
	/**
	 * Timestamp of when the health status was checked
	 */
	timestamp: string;
}

export default HealthCheckResponse;