import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString, Matches, MaxLength } from "@evelbulgroz/sanitizer-decorator";
import { SafePrimitive } from "./safe-primitive.class";


/** DTO for sanitizing a string parameter representing a domain type
 * @todo Remove APIProperty decorator if/when @evelbulgroz/sanitizer-decorator adds support for Swagger
 */
export class DomainTypeDTO extends SafePrimitive<string> {
	// _value is inherited from base class
	
	public constructor(value: string) {
		super();
		if ((value as unknown) instanceof SafePrimitive) {
			// work around bug where tests call constructor with SafePrimitive after serialization
			value = (value as unknown as SafePrimitive<string>).value;
		}	
		this.value = value;
	}

	@ApiProperty({
		type: String,
		description: 'The type of domain data to be aggregated, e.g. ConditioningLog',
		example: 'ConditioningLog',
		required: true,
	})
	@IsString({ allowNull: false, allowUndefined: false, message: 'type must be a string' })
	@IsNotEmpty({ message: 'type must not be empty' })
	@MaxLength(40, { message: 'type must have maximum 40 characters' })
	@Matches(/^(ConditioningLog)$/, { message: 'type must be one of (case-sensitive): ConditioningLog' })
	public set value(value: string) { this._value = value; }
	public get value(): string { return this._value; }
}

export default DomainTypeDTO;