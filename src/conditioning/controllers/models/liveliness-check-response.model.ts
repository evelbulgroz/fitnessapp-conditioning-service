/**
 * Response structure for liveness check endpoint
 */
export interface LivenessCheckResponse {
  /**
   * Simple status indicator
   */
  status: 'ok';
}

export default LivenessCheckResponse;