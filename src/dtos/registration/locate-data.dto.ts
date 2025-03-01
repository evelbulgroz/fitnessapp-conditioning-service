/** Specifies the information required to submit a this service instance's location request with the registry microservice
 * @remark Used for type safety when composing requests to the registry microservice
 * @remark Tokens are not part of the DTO, and should not be stored in the registry
 */
export interface LocateDataDTO {
	/** The unique identifier of the requesting service, typically a UUID */
	requestingServiceId: string;

	/** The name of the requesting service, typically in 'fitnessapp-[service name]-service' format */
	requestingServiceName: string;

	/** The name of the service to locate, typically in 'fitnessapp-[service name]-service' format */
	targetServiceName: string;
}

export default LocateDataDTO;