/** Specifies the information required to register a this service with the registry microservice
 * @remark Used for type safety when composing requests to the registry microservice
 * @remark Tokens are not part of the DTO, and should not be stored in the registry
 */
export interface ServiceDataDTO {
	/** The unique identifier of the service, typically a UUID */
	serviceId: string;

	/** The name of the service, typically in 'fitnessapp-[service name]-service' format */
	serviceName: string;

	/** The location href of the service, e.g. 'http://localhost:3000' */
	location: string;

	/** The expiration time of the service (in ms since epoch)
	 * @remark This is used to determine when the service should be removed from the registry
	 * @remark Not required when registering a service (it will be set by the registry based on token expiry)
	 */
	expires?: number;
}

export default ServiceDataDTO;