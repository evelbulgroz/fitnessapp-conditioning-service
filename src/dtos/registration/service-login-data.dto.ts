
/** Credentials and other data required by the auth microservice for logging in a system user (i.e. this service)
 * @remark Used for type safety when composing requests to the auth microservice
 * @remark For requests only: password and verification token are excluded from responses
 * @remark Excludes access token which is passed in the request header
 * @remark Must be kept up to date with the API contract of the auth microservice
 */
export interface ServiceLoginDataDTO {
	/** Unique identifier for this microservice instance as registered in the registry microservice */
	serviceId: string;

	/** Name of the microservice as registered in the registry microservice */
	serviceName: string;

	/** Password for this microservice
	 * @remark Required when submitting in a request, excluded from responses
	 */
	password?: string;

	/** Verification token for this microservice instance obtained from the registry microservice at bootstrap
	 * @remark Required when submitting in a request, excluded from responses
	 */
	verificationToken?: string;
}

export default ServiceLoginDataDTO;