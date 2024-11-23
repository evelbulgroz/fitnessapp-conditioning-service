
/** Credentials and other data required for logging in a system user (e.g. a microservice) */
export interface ServiceLoginDataDTO {
	/** Unique identifier for the microservice as registered in the service registry */
	serviceId: string;

	/** Name of the microservice as registered in the service registry */
	serviceName: string;

	/** Password for the microservice
	 * @remark Required when submitting in a request, excluded from responses
	 */
	password?: string;

	/** Verification token for the microservice obtained from the service registry at bootstrap
	 * @remark Required when submitting in a request, excluded from responses
	 */
	verificationToken?: string;
}

export default ServiceLoginDataDTO;