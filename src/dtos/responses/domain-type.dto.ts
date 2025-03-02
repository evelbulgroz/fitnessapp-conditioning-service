import { IsNotEmpty, IsString, Matches, MaxLength } from "@evelbulgroz/sanitizer-decorator";
import { SafePrimitive } from "./safe-primitive.class";


/** DTO for sanitizing a string parameter representing a domain type */
export class DomainTypeDTO extends SafePrimitive<string> {
	// _value is inherited from base class
	
	public constructor(value: string) {
		super();
		this.value = value;
	}

	@IsString({ allowNull: false, allowUndefined: false, message: 'type must be a string' })
	@IsNotEmpty({ message: 'type must not be empty' })
	@MaxLength(40, { message: 'type must have maximum 40 characters' })
	@Matches(/^(ConditioningLog)$/, { message: 'type must be one of (case-sensitive): ConditioningLog' })
	public set value(value: string) { this._value = value; }
	public get value(): string { return this._value; }
}

export default DomainTypeDTO;