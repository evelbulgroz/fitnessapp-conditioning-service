import { EntityId } from '@evelbulgroz/ddd-base';
import { IsDefined, IsInstanceOfOneOf,IsNotEmpty, MaxLength, ToString } from "@evelbulgroz/sanitizer-decorator";
import { ParamModel } from './param.model';

/** Validation model for an entity id parameter */
export class EntityIdParam extends ParamModel<EntityId> {
	// _value is inherited from ParamModel
		
	public constructor(value: EntityId) {
		super(value);
	}

	@IsDefined()
	@IsInstanceOfOneOf([String, Number], { allowNull: false, allowUndefined: false, message: 'entity id must be a string or a number' })
	@ToString() // coerce to string to enable validation of max length (if number, strings are passed through)
	@IsNotEmpty()
	@MaxLength(36, { message: 'id must have maximum 36 characters' })
	public set value(value: EntityId | undefined) { 
		// coerce back to int if original value before validation was a number:
		// since we're expecting strings to mostly be uuids, we can assume
		// original value was a number if validated value is a string that
		// can be converted to a number
		if (typeof value === 'string' && !isNaN(Number(value))) {
			value = Number(value);
		}
		this._value = value; // assigns to local prop, not the property in the parent class
	}
	public get value() { return this._value; } // local prop hides value from getter in parent class
	
}

export default EntityIdParam;