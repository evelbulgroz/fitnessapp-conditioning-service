import { IsNotEmpty,IsString ,Matches,MaxLength } from "@evelbulgroz/sanitizer-decorator";
import ParamModel from './param.model';

/** Validation model for a string parameter representing a domain type */
export class TypeParam extends ParamModel<string> {
	// _value is inherited from ParamModel
	
	public constructor(value: string) {
		super(value);
	}

	@IsString({ allowNull: false, allowUndefined: false, message: 'type must be a string' })
	@IsNotEmpty({ message: 'type must not be empty' })
	@MaxLength(40, { message: 'type must have maximum 40 characters' })
	@Matches(/^(ConditioningLog)$/, { message: 'type must be one of (case-sensitive): ConditioningLog' })
	public set value(value: string | undefined) { this._value = value; }
	public get value() { return this._value; }
}

export default TypeParam;