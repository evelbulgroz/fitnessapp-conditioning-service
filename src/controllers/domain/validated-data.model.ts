/** Base class providing default functionality for data validation classes used in controller methods.
 * @remarks This class is intended to be extended by classes that define the data structure for a controller method.
 * @remarks These are used similarly to common usage for DTOs, but in compliance with principle of DTOs only being
 *  used for data transfer, and regarded as inherently unsafe.
 */
export abstract class ValidatedData {	
	/** Check if the object is empty (i.e. all values are null or undefined)
	 * @returns true if all values are null or undefined, false otherwise.
	 * @remarks ValidationPipe returns an empty object, rather than undefined, if no data is provided for an argument in a controller method.
	 * @remarks Use this method instead of checking for undefined or null values.
	*/
	public isEmpty(): boolean {
		const keys = Object.keys(this) as (keyof this)[];
		return keys.every(key => this[key] === undefined || this[key] === null);
	}	
}