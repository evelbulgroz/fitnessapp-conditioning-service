import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

import { jest } from '@jest/globals';

function createMockExecutionContext(userRoles: { roles: string[] } = { roles: [] }): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({
				user: userRoles,
			}),
		}),
		getHandler: jest.fn(),
		getClass: jest.fn(),
	} as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
	let rolesGuard: RolesGuard;
	let reflector: Reflector;

	beforeEach(() => {
		reflector = new Reflector();
		rolesGuard = new RolesGuard(reflector);
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false); // default the public decorator check to false
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns true if no roles are defined', () => {
		const context = createMockExecutionContext();
		jest.spyOn(reflector, 'get').mockReturnValue(undefined);

		const result = rolesGuard.canActivate(context);
		expect(result).toBe(true);
	});

	it('returns true if roles are empty', () => {
		const context = createMockExecutionContext();
		jest.spyOn(reflector, 'get').mockReturnValue([]);

		const result = rolesGuard.canActivate(context);
		expect(result).toBe(true);
	});

	it('returns true if user has matching roles', () => {
		const context = createMockExecutionContext({ roles: ['admin'] });
		jest.spyOn(reflector, 'get').mockReturnValue(['admin']);

		const result = rolesGuard.canActivate(context);
		expect(result).toBe(true);
	});

	it('returns false if user does not have matching roles', () => {
		const context = createMockExecutionContext({ roles: ['user'] });
		jest.spyOn(reflector, 'get').mockReturnValue(['admin']);	

		const result = rolesGuard.canActivate(context);
		expect(result).toBe(false);
	});

	it('returns true if endpoint is public', () => {
		const context = createMockExecutionContext({ roles: ['user'] });
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true); // simulate public endpoint

		const result = rolesGuard.canActivate(context);
		expect(result).toBe(true);
	});
});