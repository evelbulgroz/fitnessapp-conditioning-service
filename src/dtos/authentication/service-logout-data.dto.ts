
/** Credentials and other data required for logging out a system user (e.g. a microservice)
 * @remarks Excludes access token which is passed in the request header
 */
export interface ServiceLogoutDataDTO {
	/** Unique identifier for the microservice as registered in the service registry */
	serviceId: string;

	/** Name of the microservice as registered in the service registry */
	serviceName: string;

	/** Refresh token issued to the microservice
	 * @remarks Required for logging out but excluded from the response for security reasons
	 */
	refreshToken?: string;
}

export default ServiceLogoutDataDTO;