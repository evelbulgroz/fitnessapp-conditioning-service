import { SafePrimitive } from './safe-primitive.class';

class SafePrimitiveMock extends SafePrimitive<string> {	
	constructor(value: string = 'test') {
		super(value);
	}

	public get value(): string {
		return this._value;
	}
}

describe('SafePrimitive', () => {
	it('should be defined', () => {
		expect(new SafePrimitiveMock()).toBeDefined();
	});

	it('should return the value', () => {
		expect(new SafePrimitiveMock().value).toBe('test');
	});
});
