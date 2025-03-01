import { IsDefined, IsString, InRange } from "@evelbulgroz/sanitizer-decorator";
import { ToLowerCase, Trim } from "@evelbulgroz/sanitizer-decorator";
import { SafePrimitive } from "./safe-primitive.class";

/** Helper class to sanitize and validate name of a service
 * @remarks Exists to facilitate validation of the request and convenient data transfer from the controller to the service
 * @remarks Data is not stored in the service, only used for validation when submitted from external requests
 */
export class ServiceName extends SafePrimitive<string> {
	/** Name of the service, typically in (lower case) 'fitnessapp-[service name]-service' format */
	@IsDefined()
	@IsString()
	@InRange({min: 3, max: 256})
	@Trim()
	@ToLowerCase()
	public set value(serviceName: string) { this._value = serviceName; }
	public get value(): string { return this._value; }
	
	constructor(serviceName: string) {
		super(serviceName);
		this.value = serviceName;
	}
}

export default ServiceName;