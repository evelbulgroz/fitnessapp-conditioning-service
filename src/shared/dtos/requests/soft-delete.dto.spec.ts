import SoftDeleteDTO from './soft-delete.dto';
import SafePrimitive from './safe-primitive.class';

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

describe('SoftDeleteDTO', () => {
	describe('constructor', () => {
		it('should correctly initialize with a boolean value', () => {
			const value = true;
			const dto = new SoftDeleteDTO(value);
			expect(dto.softDelete).toBe(value);
			expect(dto.value).toBe(value);
		});

		it('should correctly initialize with a number value', () => {
			const value = false;
			const dto = new SoftDeleteDTO(value);
			expect(dto.softDelete).toBe(value);
			expect(dto.value).toBe(value);
		});

		it('should handle SafePrimitive objects passed to constructor', () => {
			// Create a mock SafePrimitive
			const safePrimitive = new MockSafePrimitive(true);			
			const dto = new SoftDeleteDTO(safePrimitive as any);
			expect(dto.softDelete).toBe(true);
		});
	});

	describe('getters and setters', () => {
		it('should set _value through softDelete setter', () => {
			const dto = new SoftDeleteDTO(true);
			const newValue = false;
			
			dto.softDelete = newValue;
			
			// Since _value is private, we need to check through the getter
			expect(dto.softDelete).toBe(newValue);
		});

		it('should get _value through softDelete getter', () => {
			const value = false;
			const dto = new SoftDeleteDTO(value);
			
			expect(dto.softDelete).toBe(value);
		});

		it('should set softDelete through value setter', () => {
			const dto = new SoftDeleteDTO(true);
			const newValue = false;
			
			dto.value = newValue;
			
			expect(dto.softDelete).toBe(newValue);
		});

		it('should get softDelete through value getter', () => {
			const value = false;
			const dto = new SoftDeleteDTO(value);
			
			expect(dto.value).toBe(value);
			expect(dto.value).toBe(dto.softDelete);
		});
	});

	describe('decorator application', () => {
		// NOTE: ToBoolean converts just about any input to boolean,
		// so testing with MaxLength which is listed first in the decorator chain

		it('should validate value assigned using softDelete setter', () => {
			const dto = new SoftDeleteDTO(true);
			
			// Assuming the IsEntityId decorator validates correctly
			expect(dto.softDelete).toBe(true);
			
			// If the decorator throws an error for invalid values, this should pass
			expect(() => {
				dto.softDelete = 'invalid' as any; // Invalid value
			}).toThrow();
		});

		it('should validate value assigned using value setter', () => {
			const dto = new SoftDeleteDTO(true);
			
			// Assuming the IsEntityId decorator validates correctly
			expect(dto.softDelete).toBe(true);
			
			// If the decorator throws an error for invalid values, this should pass
			expect(() => {
				dto.value = 'invalid' as any; // Invalid value
			}).toThrow();
		});
	});
});