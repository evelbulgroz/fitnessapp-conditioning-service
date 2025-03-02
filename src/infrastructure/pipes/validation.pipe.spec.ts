import { ValidationPipe } from './validation.pipe';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';

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

class InvalidDTO {
	constructor(dto: any) {
		throw new Error('Invalid DTO');
	}
}

describe('ValidationPipe', () => {
	let pipe: ValidationPipe;

	beforeEach(() => {
		pipe = new ValidationPipe({ transform: true });
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
			const value = { name: 'John', age: 'thirty' };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
		});

		it('throws an error for an invalid DTO class', () => {
			const value = { name: 'John', age: 30 };
			const metadata: ArgumentMetadata = { metatype: InvalidDTO, type: 'body', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
		});

		it('passes null and undefined values without validation', () => {
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			expect(pipe.transform(null, metadata)).toBeNull();
			expect(pipe.transform(undefined, metadata)).toBeUndefined();
		});
		
		it('strips non-whitelisted properties if whitelist option is enabled', () => {
			pipe = new ValidationPipe({ transform: true, whitelist: true });
			const value = { name: 'John', age: 30, extra: 'extra' };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			const result = pipe.transform(value, metadata);
			expect(result).toBeInstanceOf(ValidDTO);
			expect(result.name).toBe('John');
			expect(result.age).toBe(30);
			expect(result).not.toHaveProperty('extra');
		});
		
		it('throws an error for non-whitelisted properties if forbidNonWhitelisted option is enabled', () => {
			pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
			const value = { name: 'John', age: 30, extra: 'extra' };
			const metadata: ArgumentMetadata = { metatype: ValidDTO, type: 'body', data: '' };
			expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
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