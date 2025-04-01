import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

import { jest } from '@jest/globals';

describe('RolesGuard', () => {
	let rolesGuard: RolesGuard;
	let reflector: Reflector;

	beforeEach(() => {
		reflector = new Reflector();
		rolesGuard = new RolesGuard(reflector);
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

	it('returns true if roles includes wildcard', () => {
		const context = createMockExecutionContext();
		jest.spyOn(reflector, 'get').mockReturnValue(['*']);

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

	function createMockExecutionContext(userRoles: { roles: string[] } = { roles: [] }): ExecutionContext {
		return {
			switchToHttp: () => ({
				getRequest: () => ({
					user: userRoles,
				}),
			}),
			getHandler: jest.fn(),
		} as unknown as ExecutionContext;
	}
});