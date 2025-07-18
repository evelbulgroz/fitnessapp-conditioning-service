import { LogIdDTO } from './log-id.dto';
import { SafePrimitive } from './safe-primitive.class';

class MockSafePrimitive extends SafePrimitive<string | number> {
	constructor(value: string | number) {
		super();
		this._value = value;
	}

	set value(value: string | number) {
		this._value = value;
	}

	get value(): string | number {
		return this._value;
	}
}

describe('LogIdDTO', () => {
	describe('constructor', () => {
		it('should correctly initialize with a string value', () => {
			const uuid = '9f859377-9531-4aee-ac11-086674d53889';
			const dto = new LogIdDTO(uuid);
			expect(dto.logId).toBe(uuid);
			expect(dto.value).toBe(uuid);
		});

		it('should correctly initialize with a number value', () => {
			const id = 12345;
			const dto = new LogIdDTO(id);
			expect(dto.logId).toBe(id);
			expect(dto.value).toBe(id);
		});

		it('should handle SafePrimitive objects passed to constructor', () => {
			// Create a mock SafePrimitive
			const safePrimitive = new MockSafePrimitive('test-uuid');			
			const dto = new LogIdDTO(safePrimitive as any);
			expect(dto.logId).toBe('test-uuid');
		});
	});

	describe('getters and setters', () => {
		it('should set _value through logId setter', () => {
			const dto = new LogIdDTO('initial');
			const newValue = 'updated-value';
			
			dto.logId = newValue;
			
			// Since _value is private, we need to check through the getter
			expect(dto.logId).toBe(newValue);
		});

		it('should get _value through logId getter', () => {
			const value = 'test-value';
			const dto = new LogIdDTO(value);
			
			expect(dto.logId).toBe(value);
		});

		it('should set logId through value setter', () => {
			const dto = new LogIdDTO('initial');
			const newValue = 'through-value-setter';
			
			dto.value = newValue;
			
			expect(dto.logId).toBe(newValue);
		});

		it('should get logId through value getter', () => {
			const value = 'test-value';
			const dto = new LogIdDTO(value);
			
			expect(dto.value).toBe(value);
			expect(dto.value).toBe(dto.logId);
		});
	});

	describe('decorator application', () => {
		it('should validate value assigned using logId setter', () => {
			const dto = new LogIdDTO('valid-uuid');
			
			// Assuming the IsEntityId decorator validates correctly
			expect(dto.logId).toBe('valid-uuid');
			
			// If the decorator throws an error for invalid values, this should pass
			expect(() => {
				dto.logId = { value: 'invalid' } as any; // Invalid value
			}).toThrow();
		});

		it('should validate value assigned using value setter', () => {
			const dto = new LogIdDTO('valid-uuid');
			
			// Assuming the IsEntityId decorator validates correctly
			expect(dto.logId).toBe('valid-uuid');
			
			// If the decorator throws an error for invalid values, this should pass
			expect(() => {
				dto.value = { value: 'invalid' } as any; // Invalid value
			}).toThrow();
		});

		it('should convert numeric string to number via decorator', () => {
			// This test assumes the IsEntityId decorator includes
			// conversion from string to number when possible
			const dto = new LogIdDTO('12345');
			
			// If the decorator is working correctly, this should be converted to a number
			// Note: This behavior depends on your decorator implementation
			expect(typeof dto.logId).toBe('number');
			expect(dto.logId).toBe(12345);
		});

		it('should preserve UUID strings via decorator', () => {
			const uuid = '9f859377-9531-4aee-ac11-086674d53889';
			const dto = new LogIdDTO(uuid);
			
			// UUID strings should not be converted to numbers
			expect(typeof dto.logId).toBe('string');
			expect(dto.logId).toBe(uuid);
		});
	});
});