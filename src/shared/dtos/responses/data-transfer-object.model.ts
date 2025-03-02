/** Abstract base class forholding sanitized complex values
 * @remark Intended to be extended by classes that define the data structure(s) for a controller method.
 */
export abstract class DataTransferObject {	
	/** Check if the object is empty (i.e. all values are null or undefined)
	 * @returns true if all values are null or undefined, false otherwise.
	 * @remark ValidationPipe returns an empty object, rather than undefined, if no data is provided for an argument in a controller method.
	 * @remark Use this method instead of checking for undefined or null values.
	*/
	public isEmpty(): boolean {
		const keys = Object.keys(this) as (keyof this)[];
		return keys.every(key => this[key] === undefined || this[key] === null);
	}

	/** Convert the object to a JSON representation.
	 * @returns A JSON representation of the object.
	 * @remark This method is intended to be overridden by subclasses to provide a JSON representation of the object.
	 */
	public abstract toJSON(): Record<string, any>;
}