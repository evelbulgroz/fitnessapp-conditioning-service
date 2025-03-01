import { IsBoolean, MaxLength, ToBoolean } from "@evelbulgroz/sanitizer-decorator";
import { ParamDTO } from "./param.dto";

/** Class for a single, sanitized boolean value received by an endpoint in a query parameter.
 * @remark Allows for validation of a boolean value received by an endpoint in a query parameter.
 * @remark Accepts undefined as a valid value, but not null.
 */
export class BooleanParamDTO extends ParamDTO<boolean> {
	// _value is inherited from ParamDTO
	
	public constructor(value?: boolean) {		
		super(value);
	}

	//@IsString({ allowNull: false, allowUndefined: true, message: 'value must be a string or undefined' })
	@MaxLength(5, { allowNull: false, allowUndefined: true, message: 'value must have maximum 5 characters' })
	@ToBoolean({ allowNull: false, allowUndefined: true, message: 'value must be a boolean or undefined' })
	@IsBoolean({ allowNull: false, allowUndefined: true, message: 'value must be a boolean or undefined' })
	public set value(value: boolean | undefined) { this._value = value; }
	public get value(): boolean | undefined { return this._value; }
}

export default BooleanParamDTO;