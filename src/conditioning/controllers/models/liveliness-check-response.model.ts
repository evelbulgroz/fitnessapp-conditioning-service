import { ApiProperty } from '@nestjs/swagger';

/**
 * Response structure for liveness check endpoint
 * 
 * @remark Indicates whether the application is alive and responsive.
 * @remark This is a simple check that does not include detailed information about the application state.
 * @remark Intended for use as an interface but implemented and decorated as a class for Swagger documentation.
 */
export class LivenessCheckResponse {
	@ApiProperty({ 
		description: 'Overall liveness status of the application',
		enum: ['up'],
		example: 'up'
	})
	status: 'up';
}

export default LivenessCheckResponse;