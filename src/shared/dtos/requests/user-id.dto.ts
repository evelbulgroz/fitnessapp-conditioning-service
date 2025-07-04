import { ApiProperty } from '@nestjs/swagger';

import { EntityId } from '@evelbulgroz/ddd-base';

import { IsEntityId } from '../../../infrastructure/decorators/is-entity-id.decorator';
import { SafePrimitive } from './safe-primitive.class';

/**
 *  DTO for sanitizing a single user id value in a response
 * 
 * @todo Refactor to subclass EntityIdDTO, following example of IncludeDeletedDTO
 * @todo Remove APIProperty decorator if/when @evelbulgroz/sanitizer-decorator adds support for Swagger
 */
export class UserIdDTO extends SafePrimitive<EntityId> {
	// _value is inherited from base class
		
	public constructor(value: EntityId) {
		super();
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
	@IsEntityId()
	set userId(value: EntityId) {
		this._value = value; // assigns to local prop, not the property in the parent class
	}
	get userId(): EntityId {
		return this._value; // local prop hides value from getter in parent class
	}

	// setter and getter for base class compatibility	
	set value(value: EntityId) { this.userId = value; }
	get value(): EntityId { return this.userId; } // getter for base class compatibility	
}

export default UserIdDTO;