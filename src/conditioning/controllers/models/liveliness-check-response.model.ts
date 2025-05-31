/**
 * Response structure for liveness check endpoint
 */
export interface LivenessCheckResponse {
  /**
   * Simple status indicator
   */
  status: 'up';
}

export default LivenessCheckResponse;