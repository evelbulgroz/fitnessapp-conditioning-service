/**
 * Response structure for comprehensive health check endpoints like /readinessz
 * 
 * @remark Extended health check including all subsystems and dependencies
 */
export interface ReadinessCheckResponse {
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
		 * Module state health info (when healthy)
		 */
		'module-state'?: {
			status: 'up';
			[key: string]: any;
		};
		
		/**
		 * Storage health info (when healthy)
		 */
		storage?: {
			status: 'up';
			[key: string]: any;
		};
		
		/**
		 * Memory heap health info (when healthy)
		 */
		memory_heap?: {
			status: 'up';
			[key: string]: any;
		};
		
		/**
		 * Memory RSS health info (when healthy)
		 */
		memory_rss?: {
			status: 'up';
			[key: string]: any;
		};
		
		[key: string]: any;
	};
	
	/**
	 * Information about unhealthy components
	 */
	error?: {
		/**
		 * Module state health info (when unhealthy)
		 */
		'module-state'?: {
			status: 'down';
			reason?: string;
			[key: string]: any;
		};
		
		/**
		 * Storage health info (when unhealthy)
		 */
		storage?: {
			status: 'down';
			reason?: string;
			[key: string]: any;
		};
		
		/**
		 * Memory heap health info (when unhealthy)
		 */
		memory_heap?: {
			status: 'down';
			reason?: string;
			[key: string]: any;
		};
		
		/**
		 * Memory RSS health info (when unhealthy)
		 */
		memory_rss?: {
			status: 'down';
			reason?: string;
			[key: string]: any;
		};
		
		/**
		 * Generic error message when health check throws an exception
		 */
		message?: string;
		
		[key: string]: any;
	};
	
	/**
	 * Detailed health information about all components
	 */
	details?: {
		[key: string]: any;
	};	
	
	/**
	 * Timestamp of when the health status was checked
	 */
	timestamp: string;
}

export default ReadinessCheckResponse;