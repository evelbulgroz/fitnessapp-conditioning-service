import { Reflector } from '@nestjs/core';
import { Roles } from './roles.decorator';

describe('Roles Decorator', () => {
	class TestClass {
		@Roles('admin', 'user')
		testMethod() {}
	}

	const reflector = new Reflector();

	it('sets metadata with the provided roles', () => {
		const roles = reflector.get<string[]>('roles', TestClass.prototype.testMethod);
		expect(roles).toEqual(['admin', 'user']);
	});

	it('sets metadata with an empty array if no roles are provided', () => {
		class TestClassEmpty {
			@Roles()
			testMethod() {}
		}

		const roles = reflector.get<string[]>('roles', TestClassEmpty.prototype.testMethod);
		expect(roles).toEqual([]);
	});
});