import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';

import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

import { createTestingModule } from '../../test/test-utils';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtAuthResult } from '../../authentication/services/jwt/domain/jwt-auth-result.model';
import { JwtAuthStrategy } from '../strategies/jwt-auth.strategy';
import { JwtPayload } from '../../authentication/services/jwt/domain/jwt-payload.model';

function createMockExecutionContext(token: string | null): ExecutionContext {
	const request = {
		headers: {
			authorization: token ? `Bearer ${token}` : null,
		},
	} as unknown as Request;

	const handler = jest.fn(); // Mock handler function
	const controller = jest.fn(); // Mock controller class

	return {
		switchToHttp: () => ({ getRequest: () => request, }),
		getHandler: () => handler, // Mock getHandler
		getClass: () => controller, // Mock getClass
	} as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
	let config: ConfigService;
	let guard: JwtAuthGuard;
	let strategy: JwtAuthStrategy;
	beforeEach(async () => {
		const module = await (await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				JwtAuthGuard,
				{
					provide: JwtAuthStrategy,
					useValue: {
						verify: jest.fn(),
						validate: jest.fn(),
					},
				},
				Reflector,
			],
		}))
		.compile();

		config = module.get<ConfigService>(ConfigService);
		guard = module.get<JwtAuthGuard>(JwtAuthGuard);
		strategy = module.get<JwtAuthStrategy>(JwtAuthStrategy);
	});

	let guardHandleRequestSpy: any;
	let payload: JwtPayload;
	let secret: string;
	let strategyValidateSpy: any;
	let strategyVerifySpy: any;
	let token: string;
	let user: JwtAuthResult;
	beforeEach(() => {
		payload = { 
			iss: 'fitnessapp-authentication-service',
			sub: uuid(),
			aud: config.get<string>('app.servicename')!,
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: 'fitnessapp-api-gateway',
			subType: 'user',
		};
		user = { userId: payload.sub, userName: payload.subName, userType: payload.subType };
		secret = config.get(`security.authentication.jwt.accessToken.secret`)!;
		token = jwt.sign(payload, secret); // sign token with secret
		guardHandleRequestSpy = jest.spyOn(guard, 'handleRequest').mockResolvedValue(user);
		strategyValidateSpy = jest.spyOn(strategy, 'validate').mockResolvedValue(user);
		strategyVerifySpy = jest.spyOn(strategy, 'verify').mockResolvedValue(payload);
	});

	afterEach(() => {
		jest.clearAllMocks();
		guardHandleRequestSpy && guardHandleRequestSpy.mockClear();
		strategyValidateSpy && strategyValidateSpy.mockClear();
		strategyVerifySpy && strategyVerifySpy.mockClear();
	});

	// NOTE: Could separate tests for canActivate() and handleRequest() more clearly, but this will do for now

	it('returns true if the token is verified and the payload is valid', async () => {
		// arrange
		const context = createMockExecutionContext(token);
		//const client = { clientId: payload.sub, clientName: payload.subName, clientType: payload.subType };

		strategyValidateSpy.mockResolvedValue(payload);
		strategyVerifySpy.mockResolvedValue(payload);

		// act
		const result = await guard.canActivate(context);

		// assert
		expect(result).toEqual(true);
		expect(strategy.verify).toHaveBeenCalledWith(token);
		expect(strategy.validate).toHaveBeenCalledWith(payload);
	});

	it('returns true if the endpoint is public', async () => {
		// arrange
		const context = createMockExecutionContext(token);
		const reflector = new Reflector();
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
		jest.spyOn(reflector, 'get').mockReturnValue(true);
		guard = new JwtAuthGuard(strategy, reflector);
		
		// act
		const result = await guard.canActivate(context);
		
		// assert
		expect(result).toEqual(true);
		expect(strategy.verify).not.toHaveBeenCalled();
		expect(strategy.validate).not.toHaveBeenCalled();
		expect(guardHandleRequestSpy).not.toHaveBeenCalled();
	});
	
	it('throws UnauthorizedException if no token is provided', async () => {
		const context = createMockExecutionContext(null);
		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
	});

	it('throws UnauthorizedException if the token is invalid', async () => {
		// arrange
		const context = createMockExecutionContext(token);
		
			// mock the strategy to throw an error causing the canActivate method pass the error to the handleRequest method
		strategyVerifySpy.mockClear();
		strategyVerifySpy.mockImplementation(() => { throw new Error('Invalid token'); });

			// mock the handleRequest method to throw an UnauthorizedException when detecting an error
		guardHandleRequestSpy.mockClear();	
		guardHandleRequestSpy.mockImplementation(() => { throw new UnauthorizedException('Invalid credentials'); });

		// act/assert
		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
	});

	it('throws UnauthorizedException if the payload is invalid', async () => {
		// arrange
		const context = createMockExecutionContext(token);
		
		// mock the strategy to throw an error causing the canActivate method pass the error to the handleRequest method
		strategyValidateSpy.mockClear();
		strategyValidateSpy.mockImplementation(() => { throw new Error('Invalid payload'); });

		// mock the handleRequest method to throw an UnauthorizedException when detecting an error
		guardHandleRequestSpy.mockClear();	
		guardHandleRequestSpy.mockImplementation(() => { throw new UnauthorizedException('Invalid credentials'); });

		// act/assert
		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
	});
});