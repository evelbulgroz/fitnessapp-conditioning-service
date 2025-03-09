import { IsDefined, IsString, InRange, Trim, ToLowerCase, Matches } from "@evelbulgroz/sanitizer-decorator";
import { DataTransferObject } from "../../../shared/dtos/responses/data-transfer-object.model";

export interface ServiceDataDTOProps {
	location: string;
	serviceId: string;
	serviceName: string;
}

/** DTO for specifying and sanitizing data about a service registered with the registry microservice
 * @remark Used for type safety when composing requests to the registry microservice
 * @remark Also used to validate responses from the registry microservice
 * @remark Must be kept up to date with the API contract of the registry microservice
 * @remark Tokens are not part of the DTO, and should not be stored in the registry
 */
export class ServiceDataDTO extends DataTransferObject {
	private _location: string;
	private _serviceId: string;
	private _serviceName: string;

	constructor(data: ServiceDataDTOProps) {
		super();
		this.location = data.location;
		this.serviceId = data.serviceId;
		this.serviceName = data.serviceName;
	}

	/** Serialize DTO instance to equivalent object literal */
	public toJSON(): ServiceDataDTOProps {
		return {
			location: this.location,
			serviceId: this.serviceId,
			serviceName: this.serviceName
		};
	}
	
	/** The location href of the service, e.g. 'https://localhost:3000' */
	@IsDefined()
	@IsString()
	@Trim()
	@InRange({min: 3, max: 256}, { inclusive: true, message: 'Location must be between 3 and 256 characters' })
	@ToLowerCase()
	@Matches(/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*(:[0-9]+)?(\/.*)?$/, { message: 'Location must be a valid URL served over https' })
	public set location(location: string) { this._location = location; }
	public get location(): string { return this._location; }
	
	/** The unique identifier of the service, typically a UUID */
	@IsDefined()
	@IsString()
	@Trim()
	@InRange({min: 3, max: 36}, { inclusive: true, message: 'Service ID must be between 3 and 36 characters' })
	public set serviceId(serviceId: string) { this._serviceId = serviceId; }
	public get serviceId(): string { return this._serviceId; }

	/** The name of the service, typically in 'fitnessapp-[service name]-service' format */
	@IsDefined()
	@IsString()
	@Trim()
	@InRange({min: 3, max: 256}, { inclusive: true, message: 'Service name must be between 3 and 256 characters' })
	@ToLowerCase()
	public set serviceName(serviceName: string) { this._serviceName = serviceName; }
	public get serviceName(): string { return this._serviceName; }
		
	
	/** The expiration time of the service (in ms since epoch)
	 * @remark This is used to determine when the service should be removed from the registry
	 * @remark Not required when registering a service (it will be set by the registry based on token expiry)
	 */
	expires?: number;
}

export default ServiceDataDTO;