/** Base helper class for sanitizing and validating primitives submitted in request from a client to the registry service
 * @remarks The intent it to ensure that data passed on from the controller to the service is always valid and safe to use
 * @remarks Doing preemptive validation and sanitization ensures data can always be trusted
 */
export abstract class SafePrimitive<T extends string | number | boolean> {
	protected _value: T;

	public constructor(value: T) {
		this._value = value;
	}
	
	/** Returns the value of the data */
	public abstract value: T;
}

export default SafePrimitive;