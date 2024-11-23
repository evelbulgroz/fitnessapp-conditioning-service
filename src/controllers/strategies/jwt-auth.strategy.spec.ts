import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { of } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { ConsoleLogger, Logger, Result } from '@evelbulgroz/ddd-base';

import { BcryptCryptoService } from '../../services/crypto/bcrypt-crypto.service';
import { createTestingModule } from '../../test/test-utils';
import { CryptoService } from '../../services/crypto/models/crypto-service.model';
import { JwtAuthResult } from '../../services/jwt/models/jwt-auth-result.model';
import { JwtAuthStrategy } from './jwt-auth.strategy';
import { JwtService } from "../../services/jwt/models/jwt-service.model";
import { User } from '../../domain/user.entity';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserJwtPayload } from '../../services/jwt/models/user-jwt-payload.model';
import { UserRepository } from '../../repositories/user.repo';
import { VerifyOptions as JwtVerifyOptions } from '../../services/jwt/models/jwt-verify-options.model';

//process.env.NODE_ENV = 'not-test'; // set NODE_ENV to not-test to enable logging

describe('JwtAuthStrategy', () => {
	let config: ConfigService;
	let crypto: CryptoService;
	let jwtAuthStrategy: JwtAuthStrategy;
	let jwtService: JwtService;
	let userRepo: UserRepository<User, UserDTO>;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			imports: [
				//ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				ConfigService,
				{
					provide: CryptoService,
					useClass: BcryptCryptoService,
				},
				JwtAuthStrategy,
				{
					provide: JwtService,
					useValue: {
					verify: jest.fn(),
					},
				},
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
				{
					provide: UserRepository,
					useValue: {
						fetchById: jest.fn()
					}
				}
			],
		});

		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		jwtAuthStrategy = module.get<JwtAuthStrategy>(JwtAuthStrategy);
		jwtService = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository<User, UserDTO>>(UserRepository);
	});

	let issuer: string;
	let payload: UserJwtPayload; // most client types will be users, not services
	let retriveUserSpy: any;
	let secret: string;
	let user: User;
	let token: string;
	let verifySpy: any;
	beforeEach(async () => {
		issuer = config.get<string>('security.authentication.jwt.issuer')!;
		payload = { 
			iss: await crypto.hash('fitnessapp-authentication-service'), // issuer is the authentication service
			sub: uuid(),
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: 'fitnessapp-api-gateway', // todo: use test user name, fix resulting errors
			subType: 'user',
		};

		secret = config.get(`security.authentication.jwt.accessToken.secret`)!;
		token = jwt.sign(payload, secret); // sign token with secret, circumventing the service
		user = (User.create({entityId: uuid(), userId: payload.sub} as UserDTO)).value as User;
		
		retriveUserSpy = jest.spyOn(userRepo, 'fetchById').mockResolvedValue(Result.ok(of(user)));
		verifySpy = jest.spyOn(jwtService, 'verify').mockResolvedValue(payload);
	});

	afterEach(() => {
		retriveUserSpy && retriveUserSpy.mockClear();
		verifySpy && verifySpy.mockClear();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(jwtAuthStrategy).toBeDefined();
	});

	describe('validate', () => {
		// NOTE: Only branching by client type for tests that require it (e.g. by using encrypted fields)
		describe('all tokens', () => {
			it('can validate a JWT payload and return the client (user or service) object', async () => {
				// arrange
				const authResult: JwtAuthResult = { userId: payload.sub, userName: payload.subName, userType: payload.subType, roles: [] };
				
				// act
				const result = await jwtAuthStrategy.validate(payload);
				
				// assert
				expect(result).toBeDefined();
				expect(result).toEqual(authResult);
			});

			it('it throws an error if clientType is not "user" or "service"', async () => {
				// arrange
				(payload as any).subType = 'invalid';
				
				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});
		});

		describe('service tokens', () => {
			beforeEach(async () => {
				// convert payload to service token format
				payload.subType = 'service';
				payload.iss = 'fitnessapp-authentication-service';
				payload.aud = config.get<string>('app.servicename')!;
			});

			it('it throws an error if the token issuer (iss) is not the authentication service', async () => {
				// arrange
				(payload as any).iss = 'invalid-service';

				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});
			
			it(`it throws an error if the token audience (aud) is not or does not include this service's name`, async () => {
				// arrange
				(payload as any).aud = 'invalid-service';

				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});

			it('throws an error if the token subject name (subName) is not a known collaborator service', async () => {
				// arrange
				(payload as any).subName = 'invalid-service';

				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});
		});

		describe('user tokens', () => {
			it('throws an error if the encrypted token issuer (iss) is not the authentication service', async () => {
				// arrange
				(payload as any).iss = await crypto.hash('invalid-service');

				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});
			
			it(`it throws an error if the encrypted token audience (aud) is not or does not include this service's name`, async () => {
				// arrange
				(payload as any).aud = await crypto.hash('invalid-service');

				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});

			it('throws an error if the token subject (sub) is not a known user', async () => {
				// arrange
				retriveUserSpy.mockClear();
				retriveUserSpy.mockResolvedValue(Result.fail('User not found'));

				// act/assert
				await expect(jwtAuthStrategy.validate(payload)).rejects.toThrow();
			});
		});
	});

	describe('verify', () => {
		it('can verify a JWT token', async () => {
			// act
			const result = await jwtAuthStrategy.verify(token, {} as JwtVerifyOptions);

			// assert
			expect(jwtService.verify).toHaveBeenCalledWith(token, {});
			expect(result).toEqual(payload);
		});

		it('throws an error if token is too large', async () => {
			// arrange
			payload.subName = 'a'.repeat(config.get<number>('security.jwt.maxTokenSize')! + 1);
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token, {} as JwtVerifyOptions)).rejects.toThrow();
		});

		it('throws an error if token is invalid', async () => {
			// arrange
			verifySpy.mockRejectedValue(new Error('Invalid token'));

			// act/assert
			await expect(jwtAuthStrategy.verify(token, {} as JwtVerifyOptions)).rejects.toThrow();
		});

		it('throws an error if token issuer is missing', async () => {
			// arrange
			delete (payload as any).iss;
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});

		it('throws an error if token audience is missing', async () => {
			// arrange
			delete (payload as any).aud;
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});

		it('throws an error if token expiry is missing', async () => {
			// arrange
			delete (payload as any).exp;

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();			
		});

		it('throws an error if token issue time is missing', async () => {
			// arrange
			delete (payload as any).iat;
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});

		it('throws an error if token id is missing', async () => {
			// arrange
			delete (payload as any).jti;
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});
		
		it('throws an error if token subject is missing', async () => {
			// arrange
			delete (payload as any).sub;
			token = jwt.sign(payload, secret);
			
			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});
		
		it('throws an error if token subject name is missing', async () => {
			// arrange
			delete (payload as any).subName;
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});

		it('throws an error if token subject type is missing', async () => {
			// arrange
			delete (payload as any).subType;
			token = jwt.sign(payload, secret);

			// act/assert
			await expect(jwtAuthStrategy.verify(token)).rejects.toThrow();
		});
	});
});