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
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks Module state refers to the overall state of the application module, such as whether it is running or not
		 */
		'module-state'?: {
			status: 'up';
		};
		
		/**
		 * Storage health info (when healthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks Storage refers to the file system or database storage used by the application
		 */
		storage?: {
			status: 'up';
		};
		
		/**
		 * Memory heap health info (when healthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks Heap = the portion of memory used for dynamic memory allocation
		 */
		memory_heap?: {
			status: 'up';
		};
		
		/**
		 * Memory RSS health info (when healthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks RSS = Resident Set Size, the portion of memory occupied by a process that is held in RAM
		 */
		memory_rss?: {
			status: 'up';
			//[key: string]: any;
		};
		
		// .. additional healthy components can be added here as needed
	};
	
	/**
	 * Information about unhealthy components
	 * 
	 * @remark This section provides details about components that are not healthy, including reasons for their unhealthiness
	 * @remark Each component can have a status of 'down' and an optional reason for the unhealthiness
	 * @remark Should be populated with an empty object if all components are healthy
	 * 
	 */
	error: {
		/**
		 * Module state health info (when unhealthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 */
		'module-state'?: {
			status: 'down';
			reason?: string;
		};
		
		/**
		 * Storage health info (when unhealthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks May include reasons like disk full, inaccessible storage, etc.
		 */
		storage?: {
			status: 'down';
			reason?: string;
		};
		
		/**
		 * Memory heap health info (when unhealthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks May include reasons like memory leaks, excessive memory usage, etc.
		 */
		memory_heap?: {
			status: 'down';
			reason?: string;
		};
		
		/**
		 * Memory RSS health info (when unhealthy)
		 * 
		 * @remark Should not include details, as these are listed in the details section
		 * @remarks May include reasons like excessive memory usage, memory leaks, etc.
		 */
		memory_rss?: {
			status: 'down';
			reason?: string;
		};
		
		/**
		 * Generic error message when health check throws an exception
		 */
		message?: string;
		
		// .. additional unhealthy components can be added here as needed
	};
	
	/**
	 * Detailed health information about all components
	 * 
	 * @remarks The exact data structure of details is not defined here, as it can vary based on the health check implementation
	 */
	details?: {
		[key: string]: any;
	};	
	
	/**
	 * Timestamp of when the health status was checked, in ISO 8601 format
	 */
	timestamp: string;
}

export default ReadinessCheckResponse;