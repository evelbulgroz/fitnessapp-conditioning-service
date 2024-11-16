/** Base class for a single, sanitized value received by an endpoint in a query parameter.
 * @param T The type of the parameter to validate
 * @remark This class is intended to be extended to provide validation for specific types.
 * @remark Standardizes access to the value of a sanitized parameter in the value property.
 * @remark Implements workaround for the issue of the framework calling the constructor twice.
 * @remark Should be overridden in subclasses to provide validation for specific params.
 */
export abstract class ParamDTO<T> {	
	protected _value: T | undefined;
	
	public constructor(value: T) {
		// assigning to setter to invoke validation
		// note: for some reason, framework calls constructor twice, at least in tests -> deal with it here
		if (value instanceof ParamDTO) { // if called with another EntityIdParam, copy its id
			this.value = value.value;
		}
		else { // if called with an EntityId (i.e. string or number), set it as id
			this.value = value;
		}
	}

	public set value(value: T | undefined) { throw new Error('Implement and validate ParamModel setter in subclass'); }
	public get value() { throw new Error('Implement ParamModel getter in subclass'); }
}

export default ParamDTO;