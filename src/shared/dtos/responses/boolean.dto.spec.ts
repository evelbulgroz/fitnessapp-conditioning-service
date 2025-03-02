import { BooleanDTO } from './boolean.dto';

describe('BooleanDTO', () => {
	it('can be created', () => {
		expect(new BooleanDTO(true)).toBeDefined();
	});

	it('can be created with undefined', () => {
		expect(new BooleanDTO(undefined as any)).toBeDefined();
	});

	it('can be created with false', () => {
		expect(new BooleanDTO(false)).toBeDefined();
	});

	it('can be created with true', () => {
		expect(new BooleanDTO(true)).toBeDefined();
	});

	it('cannot be created with null', () => {
		expect(() => new BooleanDTO(null as any)).toThrow();
	});

	// Note: just covering the basics here, decorator are already fully tested in the library

	it('converts a string to a boolean', () => {
		expect(() => new BooleanDTO('true' as any)).not.toThrow();
	});

	it('converts a number to a boolean', () => {
		expect(() => new BooleanDTO(1 as any)).not.toThrow();
	});

	it('throws if string is not a boolean', () => {
		expect(() => new BooleanDTO('not a boolean' as any)).toThrow();
	});

	it('throws if string is longer than 5 characters', () => {
		expect(() => new BooleanDTO('123456' as any)).toThrow();
	});
});