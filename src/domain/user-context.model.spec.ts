import { UserContext, UserContextProps } from './user-context.model';
import { EntityId } from '@evelbulgroz/ddd-base';
import { v4 as uuidv4 } from 'uuid';

describe('UserContext', () => {
	let props: UserContextProps;

	beforeEach(() => {
		props = {
			userId: uuidv4(),
			userName: 'testuser',
			userType: 'user',
			roles: ['admin', 'user']
		};
	});

	it('can be created', () => {
		const userContext = new UserContext(props);
		expect(userContext).toBeTruthy();
	});

	describe('userId', () => {
		it('can set and get userId as string', () => {
			const userContext = new UserContext(props);
			const newId = uuidv4();
			userContext.userId = newId;
			expect(userContext.userId).toEqual(newId);
			expect(typeof userContext.userId).toEqual('string');
		});

		it('can set and get userId as number', () => {
			const userContext = new UserContext(props);
			const newId = 42;
			userContext.userId = newId;
			expect(userContext.userId).toEqual(newId);
			expect(typeof userContext.userId).toEqual('number');
		});

		it('throws error when userId is undefined', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userId = undefined as any).toThrow();
		});

		it('throws error when userId is null', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userId = null as any).toThrow();
		});

		it('throws error when userId is an object', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userId = { a: 'blah' } as any).toThrow();
		});
	});

	describe('userName', () => {
		it('can set and get userName', () => {
			const userContext = new UserContext(props);
			const newName = 'newuser';
			userContext.userName = newName;
			expect(userContext.userName).toEqual(newName);
		});

		it('throws error when userName is undefined', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userName = undefined as any).toThrow();
		});

		it('throws error when userName is null', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userName = null as any).toThrow();
		});

		it('throws error when userName is empty', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userName = '').toThrow();
		});

		it('throws error when userName exceeds max length', () => {
			const userContext = new UserContext(props);
			const longName = 'a'.repeat(101);
			expect(() => userContext.userName = longName).toThrow();
		});
	});

	describe('userType', () => {
		it('can set and get userType', () => {
			const userContext = new UserContext(props);
			userContext.userType = 'service';
			expect(userContext.userType).toEqual('service');
		});

		it('throws error when userType is undefined', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userType = undefined as any).toThrow();
		});

		it('throws error when userType is null', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userType = null as any).toThrow();
		});

		it('throws error when userType is invalid', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.userType = 'invalid' as any).toThrow();
		});
	});

	describe('roles', () => {
		it('can set and get roles', () => {
			const userContext = new UserContext(props);
			const newRoles = ['user', 'admin'];
			userContext.roles = newRoles;
			expect(userContext.roles).toEqual(newRoles);
		});

		it('gets and sets roles immutably', () => {
			const userContext = new UserContext(props);
			const newRoles = ['user', 'admin'];
			userContext.roles = newRoles;
			newRoles.push('newrole');
			expect(userContext.roles).not.toEqual(newRoles);
		});

		it('throws error when roles is undefined', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.roles = undefined as any).toThrow();
		});

		it('throws error when roles is null', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.roles = null as any).toThrow();
		});

		it('throws error when roles is not an array', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.roles = 'invalid' as any).toThrow();
		});

		it('throws error when roles array contains non-string items', () => {
			const userContext = new UserContext(props);
			expect(() => userContext.roles = [1, 2, 3] as any).toThrow();
		});

		it('throws error when roles array exceeds max length', () => {
			const userContext = new UserContext(props);
			const longRoles = new Array(11).fill('role');
			expect(() => userContext.roles = longRoles).toThrow();
		});
	});
});