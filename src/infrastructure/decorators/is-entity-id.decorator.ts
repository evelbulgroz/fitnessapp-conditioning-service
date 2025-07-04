import { isDefined, isInstanceOfOneOf, isNotEmpty, maxLength, SanitizerFactory, SanitizerFunction, SanitizerOptions, toString } from "@evelbulgroz/sanitizer-decorator";

/**
 *  Custom decorator that combines all EntityId validations
 * 
 * This decorator is used to validate entity IDs in controller DTOs.
 * Its purpose is to make entity IDs validation reusable and consistent across the application.
 * It applies the following validations:
 * - IsDefined: Ensures the property is defined
 * - IsInstanceOfOneOf: Validates that the property is either a String or Number
 * - ToString: Converts the value to a string
 * - IsNotEmpty: Ensures the property is not empty
 * - MaxLength: Validates that the string representation of the ID does not exceed 36 characters
 * - ToNumber (custom): Converts the value to a number if it is a string that can be converted to a number, else preserves it as a string
 * 
 * @example
 * ```typescript
 * import { IsEntityId } from './is-entity-id.decorator';
 * class TestDTO {
 *  private _testId: string | number;
 *
 *  @IsEntityId()
 *    public set testId(value: string | number) {
 *       this._testId = value;
 *    }
 *    public get testId(): string | number {
 *      return this._testId;
 *    }
 * }
 * ```
 * @returns {Function} A decorator function that applies the specified validations
 * @throws {Error} If any of the validations fail, an error is thrown with a descriptive message and execution is halted.
 * 
 * @remark Setting the IsEntityId() return type to `Function` rather than 'PropertyDecorator'
 * is necessary to avoid inscrutable design time TypeScript errors when using the decorator.
 * 
 * @remark Could not get just using the decorators to work, so calling helpers directly instead.
 */
export function IsEntityId(options?: SanitizerOptions): Function { // factory enables use both with and without setter for property
	const deserializer = (value: any, propertyKey: string, self: any, localOptions = options) => isEntityId(value, propertyKey, self, localOptions);
	const sanitizerFactory = new SanitizerFactory();
	return sanitizerFactory.create(deserializer, {decorator: IsEntityId.name, propertyKey: '', options, constraint: undefined, args: undefined}) as PropertyDecorator
}

export const toNumberOrString = (value: number | string, propertyKey: string, self: any): number | string => (typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value);

export const isEntityId: SanitizerFunction<any> = (value: any, propertyKey: string, self: any, options?: SanitizerOptions): boolean => {			
	[ // Define a list of sanitizers to apply in order
		() => isDefined(value, propertyKey, self),
		() => isInstanceOfOneOf(
			value,
			propertyKey,
			self,
			{... options, message: 'entity id must be a string or a number' },
			[String, Number]
		),
		() => toString(value, propertyKey, self, {... options, message: 'entity id must be a string or a number' }),
		() => isNotEmpty(value, propertyKey, self),
		() => maxLength(value, propertyKey, self, {... options, message: 'id must have maximum 36 characters' }, 36), // bug: sees a number not a string when initial value is a number
		() => toNumberOrString(value, propertyKey, self)
	]
	.forEach((sanitizer: SanitizerFunction<any>) => { // apply sanitizers, modifying the value in place
		value = sanitizer(value, propertyKey, self, options);
	});

	return value; // Return the validated value
}

export default IsEntityId;