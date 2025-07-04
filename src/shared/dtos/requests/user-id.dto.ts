import { ApiProperty } from '@nestjs/swagger';

import { EntityId } from '@evelbulgroz/ddd-base';
import { IsDefined } from '@evelbulgroz/sanitizer-decorator';

import SafePrimitive from './safe-primitive.class';
import EntityIdDTO from './entity-id.dto';

/**
 *  DTO for sanitizing a single user id value in a response
 * 
 * @remark Defers validation to the EntityIdDTO base class, which handles entity IDs.
 * 
 * @todo Remove APIProperty decorator if/when @evelbulgroz/sanitizer-decorator adds support for Swagger
 */
export class UserIdDTO extends EntityIdDTO {
	// _value is inherited from base class
		
	public constructor(value: EntityId) {
		super(value);
		if ((value as unknown) instanceof SafePrimitive) {
			// work around bug where tests call constructor with SafePrimitive after serialization
			value = (value as unknown as SafePrimitive<EntityId>).value;
		}
		this.userId = value;
	}
	
	@ApiProperty({
		type: String,
		description: 'User ID value (string or number). Must be a valid EntityId, preferably a UUID. Must not exceed 36 characters.',
		example: '12345678-1234-1234-1234-123456789012',
		required: true
	})
	@IsDefined() // Placeholder to satisfy Validation pipe: actual validation is done in EntityIdDTO
	set userId(value: EntityId) {
		this.value = value; // assigns to local prop, not the property in the parent class
	}
	get userId(): EntityId {
		return this.value; // local prop hides value from getter in parent class
	}

		
}

export default UserIdDTO;