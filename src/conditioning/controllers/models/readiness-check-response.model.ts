import { ApiProperty } from '@nestjs/swagger';

/**
 * Response structure for comprehensive health check endpoints like /readinessz.
 * 
 * @remark Extended health check including all subsystems and dependencies.
 * @remarks This response structure is designed to provide detailed information about the health of the application, including both healthy and unhealthy components.
 * @remark Intended for use as an interface but implemented and decorated as a class for Swagger documentation.
 *  
 */
export class ReadinessCheckResponse {
	@ApiProperty({ 
		description: 'Overall health status of the application',
		enum: ['up', 'down'],
		example: 'up'
	})
	status: 'up' | 'down';
	
	@ApiProperty({
		description: 'Information about healthy components, or empty if no components are healthy',
		type: Object,
		example: {
			'module-state': { status: 'up' },
			storage: { status: 'up' },
			memory_heap: { status: 'up' },
			memory_rss: { status: 'up' }
		}
	})
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
	
	@ApiProperty({
		description: 'Information about unhealthy components, or empty if all components are healthy',
		type: Object,
		example: {
			'module-state': { status: 'down', reason: 'Module is not running' },
			storage: { status: 'down', reason: 'Disk full' },
			memory_heap: { status: 'down', reason: 'Memory leak detected' },
			memory_rss: { status: 'down', reason: 'Excessive memory usage' }
		}
	})
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
	
	@ApiProperty({
		description: 'Detailed health information about all components',
		type: Object,
		example: {
			'module-state': { status: 'up', details: { version: '1.0.0', uptime: '24h' } },
			storage: { status: 'up', details: { freeSpace: '100GB', totalSpace: '500GB' } },
			memory_heap: { status: 'up', details: { usedMemory: '200MB', totalMemory: '1GB' } },
			memory_rss: { status: 'up', details: { usedMemory: '300MB', totalMemory: '1GB' } }
		}
	})
	details?: {
		[key: string]: any;
	};	
	
	@ApiProperty({
		description: 'Timestamp of the health check in ISO 8601 format',
		example: '2023-10-01T12:00:00Z'
	})
	timestamp: string;
}

export default ReadinessCheckResponse;