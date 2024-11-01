import { th } from "date-fns/locale";

/** Validation model for a primtive endpoint parameter
 * @param T The type of the parameter to validate
 * @remarks This class is intended to be extended to provide validation for specific types.
 * @remarks Implements workaround for the issue of the framework calling the constructor twice.
 * @remarks Should be overridden in subclasses to provide validation for specific types.
 */
export abstract class ParamModel<T> {	
	protected _value: T | undefined;
	
	public constructor(value: T) {
		// assigning to setter to invoke validation
		// note: for some reason, framework calls constructor twice, at least in tests -> deal with it here
		if (value instanceof ParamModel) { // if called with another EntityIdParam, copy its id
			this.value = value.value;
		}
		else { // if called with an EntityId (i.e. string or number), set it as id
			this.value = value;
		}
	}

	public set value(value: T | undefined) { throw new Error('Implement and validate ParamModel setter in subclass'); }
	public get value() { throw new Error('Implement ParamModel getter in subclass'); }
}

export default ParamModel;