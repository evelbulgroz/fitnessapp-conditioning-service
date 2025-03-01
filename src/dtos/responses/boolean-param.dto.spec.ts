import { BooleanParamDTO } from './boolean-param.dto';

describe('BooleanParamDto', () => {
	it('can be created', () => {
		expect(new BooleanParamDTO(true)).toBeDefined();
	});

	it('can be created with undefined', () => {
		expect(new BooleanParamDTO(undefined)).toBeDefined();
	});

	it('can be created with false', () => {
		expect(new BooleanParamDTO(false)).toBeDefined();
	});

	it('can be created with true', () => {
		expect(new BooleanParamDTO(true)).toBeDefined();
	});

	it('cannot be created with null', () => {
		expect(() => new BooleanParamDTO(null as any)).toThrow();
	});

	// Note: just covering the basics here, decorator are already fully tested in the library

	it('converts a string to a boolean', () => {
		expect(() => new BooleanParamDTO('true' as any)).not.toThrow();
	});

	it('converts a number to a boolean', () => {
		expect(() => new BooleanParamDTO(1 as any)).not.toThrow();
	});

	it('throws if string is not a boolean', () => {
		expect(() => new BooleanParamDTO('not a boolean' as any)).toThrow();
	});

	it('throws if string is longer than 5 characters', () => {
		expect(() => new BooleanParamDTO('123456' as any)).toThrow();
	});
});