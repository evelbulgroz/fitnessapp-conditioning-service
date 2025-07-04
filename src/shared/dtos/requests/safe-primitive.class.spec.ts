import SafePrimitive from './safe-primitive.class';

class SafePrimitiveMock extends SafePrimitive<string> {
	constructor(value: string) {
		super();
		this.value = value;
	}

	public set value(value: string) { this._value = value; }
	public get value(): string { return this._value; }
}

describe('SafePrimitive', () => {
	it('can be created', () => {
		expect(new SafePrimitiveMock('test')).toBeDefined();
	});

	it('sets the value', () => {
		const safePrimitive = new SafePrimitiveMock('test');
		safePrimitive.value = 'test2';
		expect(safePrimitive.value).toBe('test2');
	});

	it('gets the value', () => {
		expect(new SafePrimitiveMock('test').value).toBe('test');
	});
});
