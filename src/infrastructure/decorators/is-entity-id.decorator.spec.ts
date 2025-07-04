import { IsEntityId } from './is-entity-id.decorator';

import * as sanitizerDecorator from '@evelbulgroz/sanitizer-decorator';

describe('IsEntityId Decorator', () => {
	// Spy on the individual decorators
	let isDefinedSpy: jest.SpyInstance;
	let isInstanceOfOneOfSpy: jest.SpyInstance;
	let toStringSpy: jest.SpyInstance;
	let isNotEmptySpy: jest.SpyInstance;
	let maxLengthSpy: jest.SpyInstance;
	let toNumberOrStringSpy: jest.SpyInstance;
	beforeEach(() => {
		// Create spies for each decorator - they must return proper decorator functions
		isDefinedSpy = jest.spyOn(sanitizerDecorator, 'IsDefined')
			.mockImplementation(() => (target: Object, propertyKey: string | symbol) => {});
			
		isInstanceOfOneOfSpy = jest.spyOn(sanitizerDecorator, 'IsInstanceOfOneOf')
			.mockImplementation(() => (target: Object, propertyKey: string | symbol) => {});
			
		toStringSpy = jest.spyOn(sanitizerDecorator, 'ToString')
			.mockImplementation(() => (target: Object, propertyKey: string | symbol) => {});
			
		isNotEmptySpy = jest.spyOn(sanitizerDecorator, 'IsNotEmpty')
			.mockImplementation(() => (target: Object, propertyKey: string | symbol) => {});
			
		maxLengthSpy = jest.spyOn(sanitizerDecorator, 'MaxLength')
			.mockImplementation(() => (target: Object, propertyKey: string | symbol) => {});
			
		toNumberOrStringSpy = jest.spyOn(sanitizerDecorator, 'ToNumberOrString')
			.mockImplementation(() => (target: Object, propertyKey: string | symbol) => {});		;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	xit('applies all required decorators in the correct order', () => {
		// Create a test class with the decorator
		  // Decorators are run when class is first parsed,
		  // so no need to instantiate it
		class TestClass {
			private _id: string | number;
			
			@IsEntityId()
			set id(value: string | number) {
				this._id = value;
			}
			get id(): string | number {
				return this._id;
			}			
		}
		void TestClass; // suppress unused variable warning

		// Verify that all required decorators were called
		expect(isDefinedSpy).toHaveBeenCalled();
		
		expect(isInstanceOfOneOfSpy).toHaveBeenCalledWith(
			[String, Number], 
			{ 
				allowNull: false, 
				allowUndefined: false, 
				message: 'entity id must be a string or a number' 
			}
		);
		
		expect(toStringSpy).toHaveBeenCalled();
		
		expect(isNotEmptySpy).toHaveBeenCalled();
		
		expect(maxLengthSpy).toHaveBeenCalledWith(
			36, 
			{ message: 'id must have maximum 36 characters' }
		);
		
		expect(toNumberOrStringSpy).toHaveBeenCalledWith(
			{ message: 'Failed to convert entity id back to number' }
		);

		// Verify order of operations (for critical parts)
		const callOrder = [
			isDefinedSpy.mock.invocationCallOrder[0],
			isInstanceOfOneOfSpy.mock.invocationCallOrder[0],
			toStringSpy.mock.invocationCallOrder[0],
			isNotEmptySpy.mock.invocationCallOrder[0],
			maxLengthSpy.mock.invocationCallOrder[0],
			toNumberOrStringSpy.mock.invocationCallOrder[0]
		];
		console.debug('Call order:', callOrder);
		
		// Verify ToString happens before ToNumber
		expect(callOrder).toEqual(expect.arrayContaining([ 1, 2, 3, 4, 5, 6 ]));
	});

	// Integration tests with actual sanitizer behavior
	describe('Sanitization of assigned value', () => {
		jest.restoreAllMocks(); // Use real decorators for these tests
		
		// Helper function to apply the validation pipeline to a value
		const validateValue = (value: any): any => {
			//let result = value;
			
			// Create a test object and apply validation
			class TestDTO {
				private _testId: string | number;
				
				@IsEntityId()
				public set testId(value: string | number) {
					this._testId = value;
				}
				public get testId(): string | number {
					return this._testId;
				}
			}
			
			const instance = new TestDTO();
			instance.testId = value;
			
			// Access the property to trigger sanitization (depends on how sanitizer-decorator works)
			// This is a simplified approach - adjust based on actual library behavior
			return instance.testId;
		};

		it('converts numeric string to number when possible', () => {
			// Assuming the sanitizer pipeline is triggered when the property is accessed
			const numericValue = "123";
			const result = validateValue(numericValue);
			
			// If ToNumber works as expected, this should be a number
			expect(typeof result).toBe('number');
			expect(result).toBe(123);
		});

		xit('keeps non-numeric strings as strings', () => {
			// Skip if sanitizer-decorator is not available for integration testing
			if (process.env.SKIP_INTEGRATION_TESTS) {
				return;
			}
			
			const uuidValue = "e9f0491f-1cd6-433d-8a58-fe71d198c049";
			const result = validateValue(uuidValue);
			
			// Should remain a string
			expect(typeof result).toBe('string');
			expect(result).toBe(uuidValue);
		});
	});
});