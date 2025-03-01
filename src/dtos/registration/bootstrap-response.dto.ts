import { ServiceDataDTO } from "./service-data.dto";

/** Specifies the information required to get a verification token from the microservice registry
 * @remark Used for type safety when composing requests to the microservice registry
 * @remark Tokens are not part of the DTO, and should not be stored in the microservice registry
 * @remark Must be kept up to date with the API contract of the microservice registry
 */
export interface BootstrapResponseDTO {	
	/** service data for registered authentication service, unless service is authentication service itself */
	authServiceData?: ServiceDataDTO;
	
	/** verification token for the service */
	verificationToken: string;
}

export default BootstrapResponseDTO;