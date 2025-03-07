import { IsBoolean, MaxLength, ToBoolean } from "@evelbulgroz/sanitizer-decorator";
import { SafePrimitive } from "./safe-primitive.class";

/** DTO for sanitizing a single boolean value in a response */
export class BooleanDTO extends SafePrimitive<boolean> {
	// _value is inherited from base class
	
	public constructor(value: boolean) {		
		super();
		if ((value as unknown) instanceof SafePrimitive) {
			// work around bug where tests call constructor with SafePrimitive after serialization
			value = (value as unknown as SafePrimitive<boolean>).value;
		}
		this.value = value;
	}

	@MaxLength(5, { allowNull: false, allowUndefined: true, message: 'value must have maximum 5 characters' })
	@ToBoolean({ allowNull: false, allowUndefined: true, message: 'value must be a boolean or undefined' })
	@IsBoolean({ allowNull: false, allowUndefined: true, message: 'value must be a boolean or undefined' })
	public set value(value: boolean) { this._value = value; }
	public get value(): boolean { return this._value; }
}

export default BooleanDTO;