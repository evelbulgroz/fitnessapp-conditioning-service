import { IsDefined, IsString, InRange } from "@evelbulgroz/sanitizer-decorator";
import { ToLowerCase, Trim } from "@evelbulgroz/sanitizer-decorator";
import { SafePrimitive } from "../requests/safe-primitive.class";

/** DTO for sanitizing the name of a service
 * @remarks Exists to facilitate validation of the request and convenient data transfer from the controller to the service
 * @remarks Data is not stored in the service, only used for validation when submitted from external requests
 */
export class ServiceNameDTO extends SafePrimitive<string> {
	
	constructor(serviceName: string) {
		super();
		if ((serviceName as unknown) instanceof SafePrimitive) {
			// work around bug where tests call constructor with SafePrimitive after serialization
			serviceName = (serviceName as unknown as SafePrimitive<string>).value;
		}
		this.value = serviceName;
	}
	
	/** Name of the service, typically in (lower case) 'fitnessapp-[service name]-service' format */
	@IsDefined()
	@IsString()
	@InRange({min: 3, max: 256})
	@Trim()
	@ToLowerCase()
	public set value(serviceName: string) { this._value = serviceName; }
	public get value(): string { return this._value; }
	
}

export default ServiceNameDTO;