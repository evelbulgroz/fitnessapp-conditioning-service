import { SanitizerFunction, SanitizerFactory, SanitizerOptions } from "@evelbulgroz/sanitizer-decorator"

/** Deserialize assigned string value to number when possible, otherwise keep as string
 * @param options Options for deserializer
 * @returns PropertyDecorator
 * 
 * @todo Remove this decorator when @evelbulgroz/sanitizer-decorator supports it
 */
export function ToNumberOrOriginal(options?: SanitizerOptions): PropertyDecorator {
		const deserializer = (value: any, propertyKey: string, self: any, localOptions = options) => 
				toNumberOrOriginal(value, propertyKey, self, localOptions);
		const sanitizerFactory = new SanitizerFactory();
		return sanitizerFactory.create(deserializer, {
				decorator: ToNumberOrOriginal.name, 
				propertyKey: '', 
				options, 
				constraint: undefined, 
				args: undefined
		}) as PropertyDecorator;
}

/** Deserialize assigned value to number if possible, otherwise keep as string
 * @param value Value to convert
 * @param propertyKey Name of property being deserialized
 * @param self Reference to object holding property (i.e. 'this')
 * @param options Options for deserializer
 * @returns number if conversion is possible, otherwise the original value
 */
export const toNumberOrOriginal: SanitizerFunction<any> = (
		value: any, 
		propertyKey: string, 
		self: any, 
		options?: SanitizerOptions
): number | string => {
	console.debug(`ToNumberOrOriginal: Converting value for property '${propertyKey}'`, { value, options });
	void propertyKey, self; // suppress unused variable error
	if (value === undefined) {
		if(options?.allowUndefined !== true) {
				return value;
		}
		return value;
	}
	else if (value === null) {
		if (options?.allowNull !== true) {
				return value;
		}
		return value;
	}
	
	// Already a number - return as is
	if ((typeof value === 'number' || value instanceof Number) && !isNaN(value.valueOf())) {
		return value instanceof Number ? value.valueOf() : value;
	}
	
	// If it's a string, try to convert to number
	if (typeof value === 'string' || value instanceof String) {
		const no = Number(value);
		if (!isNaN(no)) {
				return no;
		}
	}
	
	// Return original value if conversion fails
	return value;
};

export default ToNumberOrOriginal;