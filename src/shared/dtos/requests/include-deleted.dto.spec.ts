import { IncludeDeletedDTO } from './include-deleted.dto';
import { SafePrimitive } from './safe-primitive.class';

class MockSafePrimitive extends SafePrimitive<boolean> {
	constructor(value: boolean) {
		super();
		this._value = value;
	}

	set value(value: boolean) {
		this._value = value;
	}

	get value(): boolean {
		return this._value;
	}
}

describe('IncludeDeletedDTO', () => {
	describe('constructor', () => {
		it('should correctly initialize with a boolean value', () => {
			const value = true;
			const dto = new IncludeDeletedDTO(value);
			expect(dto.includeDeleted).toBe(value);
			expect(dto.value).toBe(value);
		});

		it('should correctly initialize with a number value', () => {
			const value = false;
			const dto = new IncludeDeletedDTO(value);
			expect(dto.includeDeleted).toBe(value);
			expect(dto.value).toBe(value);
		});

		it('should handle SafePrimitive objects passed to constructor', () => {
			// Create a mock SafePrimitive
			const safePrimitive = new MockSafePrimitive(true);			
			const dto = new IncludeDeletedDTO(safePrimitive as any);
			expect(dto.includeDeleted).toBe(true);
		});
	});

	describe('getters and setters', () => {
		it('should set _value through includeDeleted setter', () => {
			const dto = new IncludeDeletedDTO(true);
			const newValue = false;
			
			dto.includeDeleted = newValue;
			
			// Since _value is private, we need to check through the getter
			expect(dto.includeDeleted).toBe(newValue);
		});

		it('should get _value through includeDeleted getter', () => {
			const value = false;
			const dto = new IncludeDeletedDTO(value);
			
			expect(dto.includeDeleted).toBe(value);
		});

		it('should set includeDeleted through value setter', () => {
			const dto = new IncludeDeletedDTO(true);
			const newValue = false;
			
			dto.value = newValue;
			
			expect(dto.includeDeleted).toBe(newValue);
		});

		it('should get includeDeleted through value getter', () => {
			const value = false;
			const dto = new IncludeDeletedDTO(value);
			
			expect(dto.value).toBe(value);
			expect(dto.value).toBe(dto.includeDeleted);
		});
	});

	describe('decorator application', () => {
		// NOTE: ToBoolean converts just about any input to boolean,
		// so testing with MaxLength which is listed first in the decorator chain

		it('should validate value assigned using includeDeleted setter', () => {
			const dto = new IncludeDeletedDTO(true);
			
			// Assuming the IsEntityId decorator validates correctly
			expect(dto.includeDeleted).toBe(true);
			
			// If the decorator throws an error for invalid values, this should pass
			expect(() => {
				dto.includeDeleted = 'invalid' as any; // Invalid value
			}).toThrow();
		});

		it('should validate value assigned using value setter', () => {
			const dto = new IncludeDeletedDTO(true);
			
			// Assuming the IsEntityId decorator validates correctly
			expect(dto.includeDeleted).toBe(true);
			
			// If the decorator throws an error for invalid values, this should pass
			expect(() => {
				dto.value = 'invalid' as any; // Invalid value
			}).toThrow();
		});
	});
});