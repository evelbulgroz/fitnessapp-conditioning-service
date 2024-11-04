/** Generic JSON serializer of any kind of object.
 * @returns A JSON representation of the object
 * @remark Includes any own or inherited property of the object that is not a method or private property.
 * @remark Internally uses JSON.stringify to enable local overrides to self.
 * @remark This function is intended to be used a mixin in a class or object.
 * @todo Add support for (skipping) circular references (tried, failed!)
 * 
 * @example ```ts
 * class TestClass {
 * 	// ...
 * 
 * 	public toJSON = toJSON;	// assign to class method, mixin style ('this' will be bound to the instance)
 * }
 * ```
 */
export function toJSON(): Record<string, any>  {
	const json: Record<string, any> = {};
	
	const addProperties = (obj: any) => {
		for (const key of Object.getOwnPropertyNames(obj)) {
			if (key.startsWith('_')) continue; // exclude private properties
			if (key === 'constructor') continue; // exclude constructors

			const descriptor = Object.getOwnPropertyDescriptor(obj, key);
			if (!descriptor) continue; // exclude properties with no descriptor (e.g. methods)
			if (typeof descriptor.get !== 'function' && typeof descriptor.value === 'function') continue; // exclude methods
			
			const value = (this as any)[key];
			if (value === undefined || value === null) continue; // exclude undefined or null values
			
			// Serialize using JSON.stringify
			 // note:
			 // - this takes advantage of built-in serialization support for native types (e.g. Date, RegExp, etc.)
			 // - it also enables local overrides to toJSON() (e.g. to exclude properties)
			 // - however, since it recurses the main toJSON() function, it cannot carry over a shared list of visited objects,
			 //   and therefore will not work for skipping circular references
			 // - this requires a custom serializer: failed to get one to work (try again later)
			json[key] = JSON.parse(JSON.stringify(value));			
		}

		const prototype = Object.getPrototypeOf(obj);
		if (prototype) {
			addProperties(prototype); // recurse up the prototype chain (e.g. to include inherited properties)
		}
	};
	
	addProperties(this);
	
	return json;
}

export default toJSON;