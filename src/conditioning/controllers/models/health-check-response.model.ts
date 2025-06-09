import { ApiProperty } from '@nestjs/swagger';

import { ComponentStateInfo } from "../../../libraries/managed-stateful-component";

/**
 * Response structure for basic health check endpoints like /healthz.
 * 
 * @remark Simple health status response focused on core application state.
 * @remark Intended for use as an interface but implemented and decorated as a class for Swagger documentation.
 */
export class HealthCheckResponse {
	@ApiProperty({ 
		description: 'Overall health status of the application',
		enum: ['up', 'down'] 
	})
	status: 'up' | 'down';
	
	@ApiProperty({ description: 'Information about healthy components' })
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
	
	@ApiProperty({ description: 'Detailed error information if the health check fails' })
	error?: {
		/**
		 * Error description
		 */
		message: string;
	};
	
	@ApiProperty({ description: 'Timestamp of the health check in ISO 8601 format' })
	timestamp: string;
}

export default HealthCheckResponse;