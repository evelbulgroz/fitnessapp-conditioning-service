/** Abstract base class for holding sanitized primitive values
 * @remarks ntended to be extended by classes that define the value property
 */
export abstract class SafePrimitive<T extends string | number | boolean | undefined> {
	protected _value: T;

	// Note: Constructor must be defined in derived classes: must be concrete, and cannot call abstract setter here
	/* Template:
	public constructor(value: T) {
	 	super();
		if ((value as unknown) instanceof SafePrimitive) {
			// work around bug where tests call constructor with SafePrimitive after serialization
			serviceName = (serviceName as unknown as SafePrimitive<T>).value;
		}
		this.value = value;
	}
	*/

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