import { DataTransferObject } from './data-transfer-object.model';

class ConcreteDataModel extends DataTransferObject {
	private _value: string | undefined;

	constructor() {
		super();
	}

	public toJSON(): Record<string, any> {
		return { value: this.value };
	}

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