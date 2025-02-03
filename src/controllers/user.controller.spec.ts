import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { HttpService, HttpModule } from '@nestjs/axios';

import { lastValueFrom, of } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { Logger, Result } from '@evelbulgroz/ddd-base';

import { BcryptCryptoService } from '../services/crypto/bcrypt-crypto.service';
import { createTestingModule } from '../test/test-utils';
import { CryptoService } from '../services/crypto/models/crypto-service.model';
import { EntityIdDTO } from '../dtos/sanitization/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';
import { JwtSecretService } from '../services/jwt/jwt-secret.service';
import { JwtService } from "../services/jwt/models/jwt-service.model";
import { JsonWebtokenService } from '../services/jwt/json-webtoken.service';
import { UserContext } from '../domain/user-context.model';
import { UserController } from './user.controller';
import { UserJwtPayload } from '../services/jwt/models/user-jwt-payload.model';
import { UserRepository } from '../repositories/user.repo';
import { UserService } from '../services/user/user.service';
import { ValidationPipe } from './pipes/validation.pipe';

// NOTE:
  // Testing over http to enable decorators and guards without having to do a ton of additional setup/mocking.
  // This also ensures request/response objects are correctly formatted and that the controller is correctly configured.
  // Otherwise, this suite tests the controller in isolation from the rest of the application, i.e. as a unit test.

describe('UserController', () => {
  	let app: INestApplication;
	let controller: UserController;
	let userDataService: UserService;
	let config: ConfigService;
	let crypto: CryptoService;
	let http: HttpService;
	let jwt: JwtService;
	let baseUrl: string;
	let userRepo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule, // implicitly imports HttpService, adding service to providers array causes error
			],
			controllers: [UserController],
			providers: [
				ConfigService,
				{ // CryptoService
					provide: CryptoService,
					useClass: BcryptCryptoService,
				},
				{ // JwtAuthGuard
					provide: JwtAuthGuard,
					useValue: {
						canActivate: jest.fn(),
					},
				},
				JwtAuthStrategy, // mostly for internal use by JwtAuthGuard, but simpler to provide here
				{ // JwtSecretService
					provide: JwtSecretService,
					useFactory: (configService: ConfigService) => {
						const secret = configService.get<string>('security.authentication.jwt.accessToken.secret')!;
						return new JwtSecretService(secret);
					},
					inject: [ConfigService],
				},
				{ // JwtService
					provide: JwtService,
					useFactory: (secretService: JwtSecretService) => {
						return new JsonWebtokenService(secretService);
					},
					inject: [JwtSecretService],
				},
				{ // Logger
					provide: Logger,
					useValue: {
						log: jest.fn(),
						error: jest.fn(),
					}
				},
				{ // Data service
					provide: UserService,
					useValue: {
						createUser: jest.fn(),
						deleteUser: jest.fn(),
						undeleteUser: jest.fn(),
					},
				},
				{ // User repository
					provide: UserRepository,
					useValue: {
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
					}
				}
			],
		});		
		/*
		.overrideGuard(JwtAuthGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		.overrideGuard(RolesGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		.overrideGuard(LoggingGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		*/
		
		app = module.createNestApplication();
		controller = module.get<UserController>(UserController);
		userDataService = module.get<UserService>(UserService);
		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		http = module.get<HttpService>(HttpService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository>(UserRepository);
  
		app.useGlobalPipes(new ValidationPipe());
		await app.listen(0); // enter 0 to let the OS choose a free port
  
		const port = app.getHttpServer().address().port; // random port, e.g. 60703
		baseUrl = `http://localhost:${port}/user`; // prefix not applied during testing, so omit it
	});
  
	let adminAccessToken: string;
	let adminContext: UserContext;
	let adminPayload: UserJwtPayload;
	let userAccessToken: string;
	let headers: any;
	let userContext: UserContext;
	let userRepoFetchByIdSpy: any;
	let userMicroServiceName: string;
	beforeEach(async () => {
		userMicroServiceName = config.get<string>('security.collaborators.user.serviceName')!;
		
		adminContext = new UserContext({
			userId: uuid(),
			userName: userMicroServiceName, //'adminuser',
			userType: 'user',
			roles: ['admin'],
		});
  
		adminPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: adminContext.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: adminContext.userName,
			subType: adminContext.userType as any,
			roles: ['admin'],
		};
  
		adminAccessToken = await jwt.sign(adminPayload);
		
		userContext = new UserContext({ 
			userId: uuid(),
			userName: userMicroServiceName, //'testuser',
			userType: 'user',
			roles: ['user'],
		});

		adminPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: userContext.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: userMicroServiceName,//userContext.userName,
			subType: userContext.userType,
			roles: ['user'],
		};

		userAccessToken = await jwt.sign(adminPayload);

		headers = { Authorization: `Bearer ${adminAccessToken}` };
  
		userRepoFetchByIdSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => Promise.resolve(Result.ok(of({entityId: adminContext.userId} as any))));
	});
		  
	afterEach(() => {
		app.close();
		userRepoFetchByIdSpy && userRepoFetchByIdSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(controller).toBeDefined();
	});

	describe('Endpoints', () => {
		describe('createUser', () => {
			let requestConfig: any;
			let url: string;
			let userId: string;
			let userServiceCreateSpy: any;
			beforeEach(() => {
				requestConfig = { };
				userId = uuid();
				url = `${baseUrl}/${userId}`;
				userServiceCreateSpy = jest.spyOn(userDataService, 'createUser').mockImplementation(() => Promise.resolve(userId));
			});

			afterEach(() => {
				userServiceCreateSpy?.mockRestore();
			});

			it('creates a new user and returns an empty success message', async () => {
				// arrange				
				// act
				const response = await lastValueFrom(http.post(url, requestConfig, { headers }));

				// assert
				expect(response.status).toBe(201);
				expect(response.data).toBe('');
			});

			it('throws a BadRequestException if access token is missing', async () => {
				// arrange
				headers = {};
				const response$ = http.post(url, requestConfig, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if access token is invalid', async () => {
				// arrange
				headers = { Authorization: `Bearer invalid` };
				const response$ = http.post(url, requestConfig, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user information in token payload is invalid', async () => {
				// arrange
				adminPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				adminAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.post(url, requestConfig, { headers } );

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is missing', async () => {
				// arrange
				const response$ = http.post(baseUrl, requestConfig, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				const response$ = http.post(baseUrl + '/invalid', requestConfig, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if requester is not user microservice', async () => {
				// arrange
				adminPayload.subName = 'invalid';
				adminAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.post(url, requestConfig, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it(`throws if requester is not authorized to create user (i.e. not admin)`, async () => {
				// arrange
				headers = { Authorization: `Bearer ${userAccessToken}` };
				const response$ = http.post(url, requestConfig, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const userServiceSpy = jest.spyOn(userDataService, 'createUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
				const response$ = http.post(url, requestConfig, { headers });

				// act/assert
				 // jest can't catch errors thrown in async functions, so we have to catch it ourselves
				let error: any;
				try {
					void await lastValueFrom(response$);
				}
				catch (e) {
					error = e;					
				}
				expect(error.message).toBe(errorMessage);

				// clean up
				userServiceSpy.mockRestore();
			});
		});

		describe('deleteUser', () => {
			let requestConfig: any;
			let url: string;
			let userId: string;
			let userServiceDeleteSpy: any;
			beforeEach(() => {
				requestConfig = { };
				userId = uuid();
				url = `${baseUrl}/${userId}`;
				userServiceDeleteSpy = jest.spyOn(userDataService, 'deleteUser').mockImplementation(() => Promise.resolve());
			});

			afterEach(() => {
				userServiceDeleteSpy?.mockRestore();
			});

			it('deletes a user and returns an empty success message', async () => {
				// arrange				
				// act
				const response = await lastValueFrom(http.delete(url, { headers }));
				
				// assert
				expect(userServiceDeleteSpy).toHaveBeenCalledTimes(1);
				expect(userServiceDeleteSpy).toHaveBeenCalledWith(adminContext, new EntityIdDTO(userId), true);
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
			});

			it('by default performs a soft delete', async () => {
				// arrange
				const response = await lastValueFrom(http.delete(url, { headers }));

				// act
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
			});

			it('optionally performs a hard delete', async () => {
				// arrange
				const response = await lastValueFrom(http.delete(url + '?softDelete=true', { headers, }));

				// act
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
				expect(userServiceDeleteSpy).toHaveBeenCalledWith(adminContext, new EntityIdDTO(userId), true);
			});

			it('throws a BadRequestException if access token is missing', async () => {
				// arrange
				headers = {};
				const response$ = http.delete(url, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if access token is invalid', async () => {
				// arrange
				headers = { Authorization: `Bearer invalid` };
				const response$ = http.delete(url, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user information in token payload is invalid', async () => {
				// arrange
				adminPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				adminAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.delete(url, { headers } );

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is missing', async () => {
				// arrange
				const response$ = http.delete(baseUrl, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				const response$ = http.delete(baseUrl + '/invalid', { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if requester is not user microservice', async () => {
				// arrange
				adminPayload.subName = 'invalid';
				adminAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.delete(url, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it(`throws if requester is not authorized to delete user (i.e. not admin)`, async () => {
				// arrange
				headers = { Authorization: `Bearer ${userAccessToken}` };
				const response$ = http.delete(url, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const userServiceSpy = jest.spyOn(userDataService, 'deleteUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
				const response$ = http.delete(url, { headers });

				// act/assert
				 // jest can't catch errors thrown in async functions, so we have to catch it ourselves
				let error: any;
				try {
					void await lastValueFrom(response$);
				}
				catch (e) {
					error = e;					
				}
				expect(error.message).toBe(errorMessage);

				// clean up
				userServiceSpy.mockRestore();
			});
		});

		describe('undeleteUser', () => {
			let requestConfig: any;
			let url: string;
			let userId: string;
			let userServiceUndeleteSpy: any;
			beforeEach(() => {
				requestConfig = { };
				userId = uuid();
				url = `${baseUrl}/${userId}/undelete`;
				userServiceUndeleteSpy = jest.spyOn(userDataService, 'undeleteUser').mockImplementation(() => Promise.resolve());
			});

			afterEach(() => {
				userServiceUndeleteSpy?.mockRestore();
			});

			it('undeletes a user and returns an empty success message', async () => {
				// arrange				
				// act
				const response = await lastValueFrom(http.patch(url, requestConfig, { headers }));
				
				// assert
				expect(userServiceUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(userServiceUndeleteSpy).toHaveBeenCalledWith(adminContext, new EntityIdDTO(userId));
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
			});

			it('throws a BadRequestException if access token is missing', async () => {
				// arrange
				headers = {};
				const response$ = http.patch(url, requestConfig, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if access token is invalid', async () => {
				// arrange
				headers = { Authorization: `Bearer invalid` };
				const response$ = http.patch(url, requestConfig, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user information in token payload is invalid', async () => {
				// arrange
				adminPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				adminAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.patch(url, { headers } );

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is missing', async () => {
				// arrange
				const response$ = http.patch(baseUrl, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				const response$ = http.patch(baseUrl + '/invalid', { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if requester is not user microservice', async () => {
				// arrange
				adminPayload.subName = 'invalid';
				adminAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.patch(url, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it(`throws if requester is not authorized to undelete user (i.e. not admin)`, async () => {
				// arrange
				headers = { Authorization: `Bearer ${userAccessToken}` };
				const response$ = http.patch(url, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const userServiceSpy = jest.spyOn(userDataService, 'undeleteUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
				const response$ = http.patch(url, requestConfig, { headers });

				// act/assert
				 // jest can't catch errors thrown in async functions, so we have to catch it ourselves
				let error: any;
				try {
					void await lastValueFrom(response$);
				}
				catch (e) {
					error = e;					
				}
				expect(error.message).toBe(errorMessage);

				// clean up
				userServiceSpy.mockRestore();
			});
		});
	});
});
