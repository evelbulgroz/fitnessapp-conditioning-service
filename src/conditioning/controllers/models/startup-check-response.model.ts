/**
 * Response structure for startup check endpoint
 */
export interface StartupCheckResponse {
  /**
   * Status of application startup
   */
  status: 'started' | 'starting';
  
  /**
   * Optional message for status context
   */
  message?: string;
}

export default StartupCheckResponse;