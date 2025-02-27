
/** Credentials and other data required by the auth microservice for logging out a system user (i.e. this service)
 * @remark Used for type safety when composing requests to the auth microservice
 * @remark For requests only: refresh token is excluded from responses
 * @remark Excludes access token which is passed in the request header
 * @remark Must be kept up to date with the API contract of the auth microservice
 */
export interface ServiceLogoutDataDTO {
	/** Unique identifier for the microservice as registered in the service registry */
	serviceId: string;

	/** Name of the microservice as registered in the service registry */
	serviceName: string;

	/** Refresh token issued to the microservice
	 * @remark Required for logging out but excluded from the response for security reasons
	 */
	refreshToken?: string;
}

export default ServiceLogoutDataDTO;