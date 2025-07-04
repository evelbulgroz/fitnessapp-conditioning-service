import { ApiProperty } from '@nestjs/swagger';

import BooleanDTO from './boolean.dto';
import SafePrimitive from './safe-primitive.class';
import { IsDefined } from '@evelbulgroz/sanitizer-decorator';

/** DTO for sanitizing a single user id value in a response
 * @todo Remove APIProperty decorator if/when @evelbulgroz/sanitizer-decorator adds support for Swagger
 */
export class IncludeDeletedDTO extends BooleanDTO {
	// _value is inherited from base class
		
	public constructor(value: boolean) {
		super(value);
		if ((value as unknown) instanceof SafePrimitive) {
			// work around bug where tests call constructor with SafePrimitive after serialization
			value = (value as unknown as BooleanDTO).value;
		}
		this.includeDeleted = value;
	}
	
	@ApiProperty({
		type: String,
		description: 'Include deleted value (boolean). Must conform to validation in BooleanDTO base class.',
		required: true,
	})
	@IsDefined() // Placeholder to satisfy Validation pipe: actual validation is done in BooleanDTO
	set includeDeleted(value: boolean) {
		this.value = value; // assigns to local prop, not the property in the parent class
	}
	get includeDeleted(): boolean {
		return this.value; // local prop hides value from getter in parent class
	}

	// setter and getter for base class compatibility	
	//set value(value: boolean) { this._value = value; }
	//get value(): boolean { return this._value; } // getter for base class compatibility	
}

export default IncludeDeletedDTO;