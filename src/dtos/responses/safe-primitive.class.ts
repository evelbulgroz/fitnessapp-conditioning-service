/** Base helper class for sanitizing and validating primitives submitted in request from a client to the registry service
 * @remarks The intent it to ensure that data passed on from the controller to the service is always valid and safe to use
 * @remarks Doing preemptive validation and sanitization ensures data can always be trusted
 */
export abstract class SafePrimitive<T extends string | number | boolean | undefined> {
	protected _value: T;

	// Note: Constructor must be defined in derived classes: must be concrete, and cannot call abstract setter here
	// public constructor(value: T) {
	// 	super();
	// 	this.value = value;
	// }

	/** Sets the value of the data */
	public abstract set value(value: T);
	
	/** Returns the value of the data */
	public abstract get value(): T;

	/** Compares the value of this object to another SafePrimitive object */
	public equals(other: SafePrimitive<T>): boolean {
		return this.value === other.value;
	}
}

export default SafePrimitive;