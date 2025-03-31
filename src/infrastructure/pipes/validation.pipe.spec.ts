import { ValidationPipe } from './validation.pipe';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';

class MockedValidationPipe extends ValidationPipe {
	constructor(options: any) {
		super(options);
	}

	// Override the stripProperties to enable testing
	public stripProperties(value: any, object: any) {
		return super.stripProperties(value, object);
	}

	// Override the checkForNonWhitelistedProperties to enable testing
	public checkForNonWhitelistedProperties(value: any, object: any) {
		return super.checkForNonWhitelistedProperties(value, object);
	}
}

class PrimitiveDTO {
	constructor(value: string) {
		this.value = value;
	}
	value: string;
}

class InvalidDTO {
	constructor(dto: any) {
		throw new Error('Invalid DTO');
	}
}

class ValidDTO {
	name: string;
	age: number;

	constructor(dto: any) {
		if (!dto.name) {
			throw new Error('Name is required');
		}
		if (typeof dto.age !== 'number') {
			throw new Error('Age must be a number');
		}
		this.name = dto.name;
		this.age = dto.age;
	}
}

describe('ValidationPipe', () => {
	let pipe: MockedValidationPipe;

	beforeEach(() => {
		pipe = new MockedValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('DTO (i.e. JSON object) validation', () => {
		it('validates and transforms a valid DTO', () => {
			const value = { name: 'John', age: 30 };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			const result = pipe.transform(value, metadata);
			expect(result).toBeInstanceOf(ValidDTO);
			expect(result.name).toBe('John');
			expect(result.age).toBe(30);
		});

		it('throws an error for an invalid DTO', () => {
			const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // suppress console.error output
			const value = { name: 'John', age: 'thirty' };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
			errorSpy.mockRestore(); // restore the original console.error
		});

		it('throws an error for an invalid DTO class', () => {
			const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // suppress console.error output
			const value = { name: 'John', age: 30 };
			const metadata: ArgumentMetadata = { metatype: InvalidDTO, type: 'body', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
			errorSpy.mockRestore(); // restore the original console.error
		});

		it('passes null and undefined values without validation', () => {
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			expect(pipe.transform(null, metadata)).toBeNull();
			expect(pipe.transform(undefined, metadata)).toBeUndefined();
		});
		
		it('strips non-whitelisted properties if whitelist option is enabled', () => {
			const value = { name: 'John', age: 30, extra: 'extra' };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			pipe = new MockedValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false });
			const result = pipe.transform(value, metadata);
			expect(result).toBeInstanceOf(ValidDTO);
			expect(result.name).toBe('John');
			expect(result.age).toBe(30);
			expect(result).not.toHaveProperty('extra');
		});
		
		it('throws an error for non-whitelisted properties if forbidNonWhitelisted option is enabled', () => {
			// arrange
			jest.spyOn(console, 'error').mockImplementation(() => {}); // suppress console.error output
			const value = { name: 'John', age: 30, extra: 'extra' };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };

			// act & assert
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);

			// cleanup
			(console.error as jest.Mock).mockRestore();
		});

		it('skips forbidNonWhitelisted if value is a primitive validated by a DTO', () => {
			// arrange
			const value = '12345678-1234-1234-1234-123456789012';
			const metadata: ArgumentMetadata = { metatype: PrimitiveDTO, type: 'param', data: 'uuid' };
			const whitelistSpy = jest.spyOn(pipe, 'checkForNonWhitelistedProperties');

			// act
			const result = pipe.transform(value, metadata);

			// assert
			expect(result).toEqual(new PrimitiveDTO(value));
			expect(result.value).toBe(value);
			expect(whitelistSpy).not.toHaveBeenCalled();

			// cleanup
			whitelistSpy && whitelistSpy.mockRestore();
		});

		it('skips whitelist if value is a primitive validated by a DTO', () => {			
			// arrange
			const value = '12345678-1234-1234-1234-123456789012';
			const metadata: ArgumentMetadata = { metatype: PrimitiveDTO, type: 'param', data: 'uuid' };
			const whitelistSpy = jest.spyOn(pipe, 'stripProperties');

			// act
			const result = pipe.transform(value, metadata);

			// assert
			expect(result).toEqual(new PrimitiveDTO(value));
			expect(result.value).toBe(value);
			expect(whitelistSpy).not.toHaveBeenCalled();

			// cleanup
			whitelistSpy && whitelistSpy.mockRestore();
		});
	});
	
	describe('Primitive type validation and transformation', () => {
		it('transforms a valid boolean primitive', () => {
			const value = 'true';
			const metadata: ArgumentMetadata = { metatype: Boolean, type: 'query', data: '' };
			const result = pipe.transform(value, metadata);
			expect(result).toBe(true);
		});

		it('throws an error for an invalid boolean primitive', () => {
			const value = 'not-a-boolean';
			const metadata: ArgumentMetadata = { metatype: Boolean, type: 'query', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
		});

		it('transforms a valid number primitive', () => {
			const value = '42';
			const metadata: ArgumentMetadata = { metatype: Number, type: 'query', data: '' };
			const result = pipe.transform(value, metadata);
			expect(result).toBe(42);
		});

		it('throws an error for an invalid number primitive', () => {
			const value = 'not-a-number';
			const metadata: ArgumentMetadata = { metatype: Number, type: 'query', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
		});

		it('transforms a valid string primitive', () => {
			const value = 123;
			const metadata: ArgumentMetadata = { metatype: String, type: 'query', data: '' };
			const result = pipe.transform(value, metadata);
			expect(result).toBe('123');
		});

		it('transforms a valid array primitive', () => {
			const value = '[1, 2, 3]';
			const metadata: ArgumentMetadata = { metatype: Array, type: 'query', data: '' };
			const result = pipe.transform(value, metadata);
			expect(result).toEqual([1, 2, 3]);
		});
		
		it('throws an error for an invalid array primitive', () => {
			const value = 'not-an-array';
			const metadata: ArgumentMetadata = { metatype: Array, type: 'query', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
		});
	});
});