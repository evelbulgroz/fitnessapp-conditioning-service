import { ApiProperty } from '@nestjs/swagger';

/**
 * Response structure for startup check endpoint
 */
export class StartupCheckResponse {
	@ApiProperty({
		description: 'Overall startup status of the application',
		enum: ['started', 'starting'],
		example: 'started'
	})
	status: 'started' | 'starting';

	@ApiProperty({
		description: 'Optional message providing additional context about the startup status',
		example: 'Application has started successfully'
	})
	message?: string;  
	
	@ApiProperty({
		description: 'Timestamp of the health check in ISO 8601 format',
		example: '2023-10-01T12:00:00Z'
	})
	timestamp: string;
}

export default StartupCheckResponse;