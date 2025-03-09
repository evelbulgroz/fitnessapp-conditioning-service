
/** Specifies the data required for refreshing an auth/access token for a system user (e.g. microservice) */
export interface ServiceTokenRefreshDataDTO {
	/** Unique identifier for the microservice as registered in the service registry */
	serviceId: string;

	/** Name of the microservice as registered in the service registry */
	serviceName: string;

	/** Refresh token for the requesting microservice
	 * @remark Required when submitting in a request, excluded from responses
	 */
	refreshToken?: string;
}

export default ServiceTokenRefreshDataDTO;