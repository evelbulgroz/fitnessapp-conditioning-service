import { ValidatedData } from './validated-data.model';

class ConcreteDataModel extends ValidatedData {
	private _value: string | undefined;

	set value(value: string | undefined) { this._value = value; }
	get value() { return this._value; }
}

describe('ValidatedData', () => {
	let data: ConcreteDataModel;

	beforeEach(() => {
		data = new ConcreteDataModel();
	});

	it('can be created', () => {
		expect(data).toBeTruthy();
	});

	describe('isEmpty', () => {
		it('should return true when all properties are undefined', () => {
			expect(data.isEmpty()).toBe(true);
		});

		it('should return false when at least one property is not undefined', () => {
			data.value = 'test';
			expect(data.isEmpty()).toBe(false);
		});
	});
});