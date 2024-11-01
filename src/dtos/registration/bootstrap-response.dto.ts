import { ServiceDataDTO } from "./service-data.dto";

export interface BootstrapResponseDTO {	
	/** service data for registered authentication service, unless service is authentication service itself */
	authServiceData?: ServiceDataDTO;
	
	/** verification token for the service */
	verificationToken: string;
}

export default BootstrapResponseDTO;