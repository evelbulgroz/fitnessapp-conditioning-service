import { TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';

import { JwtPayload } from '../../services/jwt/models/jwt-payload.model';
import { ConfigService } from '@nestjs/config';
import { createTestingModule } from '../../test/test-utils';
import { JsonWebtokenService } from './json-webtoken.service';
import { Jwt } from "./models/jwt.model";
import { JwtSecretService } from './jwt-secret.service';
import { SignOptions as JwtSignOptions } from "./models/jwt-sign-options.model";
import { UserJwtPayload } from "./models/user-jwt-payload.model";
import { VerifyOptions as JwtVerifyOptions } from "./models/jwt-verify-options.model";
import JwtService from './models/jwt-service.model';

function encryptproperty(property: string): string { return bcrypt.hashSync(property, bcrypt.genSaltSync(10)); }

// NOTE: Tried mocking and spying on jsonwebtoken but couldn't get it to work, so I just tested the service directly

describe('JsonWebtokenService', () => {
	let config: ConfigService;
	let secretService: JwtSecretService
	let service: JwtService;	
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			imports: [
				//ConfigModule is imported automatically by createTestingModule
			],
			providers: [				
				ConfigService,
				{
					provide: JwtSecretService,
					useFactory: (configService: ConfigService) => {
						const secret = configService.get<string>('security.authentication.jwt.accessToken.secret')!;
						return new JwtSecretService(secret);
					},
					inject: [ConfigService],
				},
				{
					provide: JwtService,
					useFactory: (secretService: JwtSecretService) => {
					 return new JsonWebtokenService(secretService);
					},
					inject: [JwtSecretService],
				},
			],
		});

		config = module.get<ConfigService>(ConfigService);
		secretService = module.get<JwtSecretService>(JwtSecretService);
		service = module.get<JwtService>(JwtService);		
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	xit('can be created', () => {
		expect(service).toBeDefined();
	});

	describe('microservice', () => {
		let iss: string;
		let sub: string;
		let subName: string;
		let secret: string;
		let testPayload: JwtPayload;
		let testToken: string;
		beforeEach(() => {
			iss = config.get(`security.authentication.jwt.issuer`)!;
			sub = uuid();
			subName = 'fitnessapp-api-gateway';
			secret = config.get(`security.authentication.jwt.accessToken.secret`)!;
			testPayload = {
				iss,
				sub,
				aud: config.get<string>('app.servicename')!,
				exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
				iat: Math.floor(Date.now() / 1000),
				jti: uuid(),
				subName,
				subType: 'service',
			};
			testToken = jwt.sign(testPayload, secret); // sign token with secret, circumventing the service
		});

		describe('decode', () => {
			it('can decode a microservice token successfully', async () => {
				// arrange
				
				// act
				const decoded = await service.decode(testToken, {}) as JwtPayload;
				// assert
				expect(decoded).toBeDefined();
				expect(decoded).toEqual(testPayload);
			});

			it('can decode a microservice token successfully using decode options', async () => {
				// arrange
				const options = { complete: true }; // include header etc. in decoded payload
				
				// act
				const decoded = await service.decode(testToken, options) as any;
				
				// assert
				expect(decoded.header).toBeDefined(); // make sure decoded payload has header indicating token options were used
			});

			it('throws an error if microservice token decoding fails', async () => {
				// arrange
				const invalidToken = 'invalid token';

				// act
				const decode = async () => await service.decode(invalidToken);

				// assert
				await expect(decode()).rejects.toThrowError();
			});
		});

		describe('sign', () => {
			it('can sign a microservice token successfully', async () => {
				// arrange
				
				// act
				const token = await service.sign(testPayload);

				// assert
				expect(token).toBeDefined();

				// verify token
				const decoded = jwt.verify(token, secret) as JwtPayload;
				expect(decoded).toEqual(testPayload);  
			});

			it('can sign a microservice token successfully using signing options', async () => {
				// arrange
				const now = Math.floor(Date.now() / 1000);
				const expiresIn = 10 * 60 * 60; // 10 hours from now
				const options: JwtSignOptions = { expiresIn } // 10 hours from now
				delete (testPayload as any).exp; // remove expiration from payload so options can set it

				// act
				const token = await service.sign(testPayload, options) as string;

				// assert
				expect(token).toBeDefined();
				
				const decoded = jwt.verify(token, secret) as JwtPayload;
				testPayload.exp = now + expiresIn; // add expiration back to payload for comparison
				expect(decoded).toEqual(testPayload);

				
			});

			it('throws an error if microservice token signing fails', async () => {
				// arrange
				
				// act
				const sign = async () => await service.sign(undefined as any);

				// assert
				await expect(sign()).rejects.toThrowError();
			});
		});

		describe('verify', () => {
			it('can verify a microservice token successfully', async () => {
				// arrange
				
				// act
				const decoded = await service.verify(testToken) as JwtPayload;

				// assert
				expect(decoded).toEqual(testPayload); // make sure decoded payload has properties from original payload			
			});

			it('can verify a microservice token successfully using verification options', async () => {
				// arrange
				const options: JwtVerifyOptions = { complete: true }; // include header etc. in decoded payload
				
				// act
				const result = await service.verify(testToken, options) as Jwt;
				
				// assert
				expect(result.header).toBeDefined(); // make sure decoded payload has header indicating token options were used
			});

			
			it('throws an error if microservice token verification fails', async () => {
				// arrange
				const invalidToken = 'invalid token';

				// act
				const verify = async () => await service.verify(invalidToken);

				// assert
				await expect(verify()).rejects.toThrowError();
			});
		});
	});

	xdescribe('user', () => {
		let sub: string;
		let subName: string;
		let testPayload: UserJwtPayload;
		let testToken: string;
		let secret: string;
		beforeEach(() => {
			sub = uuid();
			subName = 'test-user';
			testPayload = {
				iss: encryptproperty('fitnessapp-authentication-service'),
				sub,
				aud: encryptproperty(config.get<string>('app.servicename')!),
				exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
				iat: Math.floor(Date.now() / 1000),
				jti: uuid(),
				subName,
				subType: 'user',
			};
			secret = config.get(`security.authentication.jwt.fitnessapp-authentication-service.tokenSecret`)!;
			testToken = jwt.sign(testPayload, secret); // sign token with secret, circumventing the service
		});

		describe('decode', () => {
			it('can decode a user token successfully', async () => {
				// arrange
				
				// act
				const decoded = await service.decode(testToken, {}) as JwtPayload;
				// assert
				expect(decoded).toBeDefined();
				expect(decoded).toEqual(testPayload);
			});

			it('can decode a user token successfully using decode options', async () => {
				// arrange
				const options = { complete: true }; // include header etc. in decoded payload
				
				// act
				const decoded = await service.decode(testToken, options) as any;
				
				// assert
				expect(decoded.header).toBeDefined(); // make sure decoded payload has header indicating token options were used
			});

			it('throws an error if user token decoding fails', async () => {
				// arrange
				const invalidToken = 'invalid token';

				// act
				const decode = async () => await service.decode(invalidToken);

				// assert
				await expect(decode()).rejects.toThrowError();
			});
		});

		describe('sign', () => {
			it('can sign a user token successfully', async () => {
				// arrange
				
				// act
				const token = await service.sign(testPayload);

				// assert
				expect(token).toBeDefined();

				  // verify token
				const decoded = jwt.verify(token, secret) as JwtPayload;
				expect(decoded).toEqual(testPayload);  
			});

			it('can sign a user token successfully using signing options', async () => {
				// arrange
				const now = Math.floor(Date.now() / 1000);
				const expiresIn = 10 * 60 * 60; // 10 hours from now
				const options: JwtSignOptions = { expiresIn } // 10 hours from now
				delete (testPayload as any).exp; // remove expiration from payload so options can set it

				// act
				const token = await service.sign(testPayload, options) as string;

				// assert
				expect(token).toBeDefined();
				
				  // verify that options set the expiration
				const decoded = jwt.verify(token, secret) as JwtPayload;
				testPayload.exp = now + expiresIn; // add expiration back to payload for comparison
				expect(decoded).toEqual(testPayload);

				
			});

			it('throws an error if user token signing fails', async () => {
				// arrange
				
				// act
				const sign = async () => await service.sign(undefined as any);

				// assert
				await expect(sign()).rejects.toThrowError();
			});
		});

		describe('verify', () => {
			it('can verify a user token successfully', async () => {
				// arrange
				
				// act
				const decoded = await service.verify(testToken) as JwtPayload;

				// assert
				expect(decoded).toEqual(testPayload); // make sure decoded payload has properties from original payload			
			});

			it('can verify a user token successfully using verification options', async () => {
				// arrange
				const options: JwtVerifyOptions = { complete: true }; // include header etc. in decoded payload
				
				// act
				const result = await service.verify(testToken, options) as Jwt;
				
				// assert
				expect(result.header).toBeDefined(); // make sure decoded payload has header indicating token options were used
			});

			
			it('throws an error if user token verification fails', async () => {
				// arrange
				const invalidToken = 'invalid token';

				// act
				const verify = async () => await service.verify(invalidToken);

				// assert
				await expect(verify()).rejects.toThrowError();
			});
		});
	});
});