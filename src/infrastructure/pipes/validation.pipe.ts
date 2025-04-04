import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

/** Specifies the options for the ValidationPipe */
export interface ValidationPipeOptions {
	/** If true, strips properties that do not have any decorators */
	whitelist?: boolean;

	/** If true, throws an error if a property is not whitelisted */
	forbidNonWhitelisted?: boolean;

	/** If true, transforms the input value to the expected type */
	transform?: boolean;
}

/** Validation pipe for validating raw data in controller request params, query, body, etc
 * @remark Intended to be used with validated classes with a constructor that preemptively validates the input
 * @remark Simplified version of the NestJS ValidationPipe that does not use class-validator or class-transformer in compliance with the architecture:
 * @see https://github.com/evelbulgroz/fitnessapp-api-gateway/blob/main/documentation/architecture.md
 * @remark Supports a reduced set of options defined by the ValidationPipeOptions interface
 * @remark Whitelisting and non-whitelisting are supported, but only for properties that are not primitive types (string, boolean, number, array, object)
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
	protected readonly options: ValidationPipeOptions = {
		whitelist: false,
		forbidNonWhitelisted: false,
		transform: false,
	};
	
	/** Create a new instance of the ValidationPipe
	 * @param options The options for the pipe
	 * @remark The options are optional and all default to false
	 * @remark The options are:
	 * @remark - whitelist: If true, strips properties that do not have any decorators
	 * @remark - forbidNonWhitelisted: If true, throws an error if a property is not whitelisted
	 * @remark - transform: If true, transforms the input value to the expected type
	 */
	constructor(options?: ValidationPipeOptions) {
		if (options) {
			Object.assign(this.options, options);
		}
	}
	
	/** Transform the input value to the expected type
	 * @param value The input value to transform
	 * @param metadata The metadata for the input value
	 * @returns The transformed value
	 * @throws BadRequestException if the transformation fails
	 * @remark Primitive params are passed through without transformation, but wrapped in an object literal with param name as key
	 */
	public transform(value: any, metadata: ArgumentMetadata) {
		if (value === undefined || value === null) {
			return value;
		}
	
		const { metatype } = metadata;
	
		if (!metatype || !this.toValidate(metatype)) {
			return this.options.transform && this.isPrimitive(value)
				? this.transformPrimitive(value, metadata)
				: value;
		}
	
		try {
			const object = new metatype(value);
			
			if (this.isPrimitive(value)) { // if the value is a primitive, skip the whitelist checks
				return object;
			}
			
			
			if (this.options.forbidNonWhitelisted) { //bug: assumes value is an object, not a primitive type
				this.checkForNonWhitelistedProperties(value, object); // bug: faild if value is a primitive type
			}
			
			if (this.options.whitelist) {
				this.stripProperties(value, object);
			}
		
			
		
			return object;
		}
		catch (error) {
			console.error(error);
			throw new BadRequestException('Validation failed');
		}
	}
	
	// Check if the value should be validated aginst whitelist or not
	// If the metatype is not a primitive type, we need to validate it
	// Otherwise, we can skip validation
	protected toValidate(metatype: Function): boolean {
		const types: Function[] = [String, Boolean, Number, Array, Object];
		return !types.includes(metatype);
	}
	
	// Check if the value is a primitive type (string, boolean, number)
	protected isPrimitive(value: any): boolean {
		return ['string', 'boolean', 'number'].includes(typeof value);
	}
	
	// Transform the value to the expected primitive type indicated by the metadata
	protected transformPrimitive(value: any, metadata: ArgumentMetadata): any {
		const { metatype } = metadata;
		if (metatype === Boolean) {
			return this.toBoolean(value);
		} else if (metatype === Number) {
			return this.toNumber(value);
		} else if (metatype === String) {
			return String(value);
		} else if (metatype === Array) {
			return this.toArray(value);
		} else if (metatype === Object) {
			return this.toObject(value);
		}
		return value; // default: no transformation
	}
	
	// Convert the value to a boolean
	protected toBoolean(value: any): boolean {
		if (value === 'true' || value === true) {
		return true;
		} else if (value === 'false' || value === false) {
		return false;
		}
		throw new BadRequestException('Validation failed (boolean expected)');
	}
	
	// Convert the value to a number
	protected toNumber(value: any): number {
		const number = Number(value);
		if (isNaN(number)) {
			throw new BadRequestException('Validation failed (number expected)');
		}
		return number;
	}
	
	// Convert the value to an array
	protected toArray(value: any): any[] {
		try {
			return JSON.parse(value);
		}
		catch {
			throw new BadRequestException('Validation failed (array expected)');
		}
	}
	
	// Convert the value to an object
	protected toObject(value: any): object {
		try {
			return JSON.parse(value);
		}
		catch {
			throw new BadRequestException('Validation failed (object expected)');
		}
	}
	
	// Strip properties that are not present in the validated class
	protected stripProperties(value: any, object: any) {
		for (const key in value) {
			if (!object.hasOwnProperty(key)) {
				delete value[key];
			}
		}
	}
	
	// Check if the value has properties that are not present in the validated class
	protected checkForNonWhitelistedProperties(value: any, object: any) {		
		for (const key in value) {
			if (!object.hasOwnProperty(key)) {
				throw new BadRequestException(`Validation failed (property ${key} is not allowed)`);
			}
		}
	}
}

export default ValidationPipe;