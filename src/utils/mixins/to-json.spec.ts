import toJSON from './to-json';

describe('toJSON', () => {
	describe('properties with getters', () => {
		it('serializes properties with getters', () => {
			const obj = {
				get prop1() {
					return 'value1';
				},
				get prop2() {
					return 'value2';
				},

				toJSON: toJSON
			}
			expect(obj.toJSON()).toEqual({ prop1: 'value1', prop2: 'value2' });
		});

		it('serializes inherited properties', () => {
			const obj = Object.create({
				get inheritedProp() {
					return 'inherited value';
				},
				toJSON: toJSON
			}, {});
			expect(obj.toJSON()).toEqual({inheritedProp: 'inherited value' });
		});

		it('serializes array properties', () => {
			const obj = {
				get prop() {
					return [1, 2, 3];
				},

				toJSON: toJSON
			}
			const json = obj.toJSON();
			expect(json).toEqual({ prop: [1, 2, 3] });
		});

		it('serializes nested arrays properties', () => {
			const obj = {
				get prop() {
					return [[1,2,3], [4,5,6]];
				},

				toJSON: toJSON
			}
			const json = obj.toJSON();
			expect(json).toEqual({ prop: [[1,2,3], [4,5,6]] });
		});

		it('serializes nested objects', () => {
			const obj = {
				get prop() {
					return {
						get nestedProp() {
							return 'value'
						},
						toJSON: toJSON
					}
				},
				toJSON: toJSON
			}
			expect(obj.toJSON()).toEqual({ prop: { nestedProp: 'value' } });
		});
	});

	describe('properties without getters', () => {
		it('serializes properties without getters', () => {
			const obj = {
				prop1: 'value1',
				prop2: 'value2',
				toJSON: toJSON
			}
			expect(obj.toJSON()).toEqual({ prop1: 'value1', prop2: 'value2' });
		});

		it('serializes inherited properties', () => {
			const obj = Object.create({
				inheritedProp: 'inherited value',
				toJSON: toJSON
			}, {});
			expect(obj.toJSON()).toEqual({inheritedProp: 'inherited value' });
		});

		it('serializes array properties', () => {
			const obj = {
				prop: [1, 2, 3],
				toJSON: toJSON
			}
			const json = obj.toJSON();
			expect(json).toEqual({ prop: [1, 2, 3] });
		});

		it('serializes nested arrays properties', () => {
			const obj = {
				prop: [[1,2,3], [4,5,6]],
				toJSON: toJSON
			}
			const json = obj.toJSON();
			expect(json).toEqual({ prop: [[1,2,3], [4,5,6]] });
		});

		it('serializes nested objects', () => {
			const obj = {
				prop: {
					nestedProp: 'value',
					toJSON: toJSON
				},
				toJSON: toJSON
			}
			expect(obj.toJSON()).toEqual({ prop: { nestedProp: 'value' } });
		});
	});

	it('serializes mixed properties', () => {
		const obj = {
			get prop1() {
				return 'value1';
			},
			prop2: 'value2',
			toJSON: toJSON
		}
		expect(obj.toJSON()).toEqual({ prop1: 'value1', prop2: 'value2' });
	});	
	
	it('does not serialize private properties (i.e. keys starting with underscore)', () => {
		const obj = {
			_prop: 'value',
			toJSON: toJSON
		}
		expect(obj.toJSON()).toEqual({});
	});

	it('does not serialize constructors', () => {
		const obj = {
			constructor: 'value',
			toJSON: toJSON
		}
		expect(obj.toJSON()).toEqual({});
	});

	it('does not serialize methods', () => {
		const obj = {
			method: () => 'value',
			toJSON: toJSON
		}
		expect(obj.toJSON()).toEqual({});
	});

	xit('skips circular references', () => {
		const obj: any = {
			prop: 'value',
			toJSON: toJSON
		}
		obj.circular = obj;
		const json = obj.toJSON();
		expect(json).toEqual({ prop: 'value' });
		expect(json.circular).toBeUndefined();
	});

	// skips properties with undefined or null values
});