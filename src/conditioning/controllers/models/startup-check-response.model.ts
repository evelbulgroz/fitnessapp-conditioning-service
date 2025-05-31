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
	
	/**
	 * Timestamp of when the health status was checked
	 */
	timestamp: string;
}

export default StartupCheckResponse;