import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { HttpService, HttpModule } from '@nestjs/axios';

import { lastValueFrom, of, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { Result } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLogger } from '../../../src/libraries/stream-loggable';

import BcryptCryptoService from '../../../src/authentication/services/crypto/bcrypt-crypto.service';
import createTestingModule from '../../../src/test/test-utils';
import CryptoService from '../../../src/authentication/services/crypto/domain/crypto-service.model';
import EntityIdDTO from '../../../src/shared/dtos/requests/entity-id.dto';
import JwtAuthGuard from '../../../src/infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../../../src/infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from '../../../src/authentication/services/jwt/jwt-secret.service';
import JwtService from '../../../src/authentication/services/jwt/domain/jwt-service.model';
import JsonWebtokenService from '../../../src/authentication/services/jwt/json-webtoken.service';
import UserContext from '../../../src/shared/domain/user-context.model';
import UserController from '../../../src/user/controllers/user.controller';
import UserJwtPayload from '../../../src/authentication/services/jwt/domain/user-jwt-payload.model';
import UserRepository from '../../../src/user/repositories/user.repo';
import UserDataService from '../../../src/user/services/user-data.service';
import ValidationPipe from '../../../src/infrastructure/pipes/validation.pipe';

// NOTE:
  // Testing over http to enable decorators and guards without having to do a ton of additional setup/mocking.
  // This also ensures request/response objects are correctly formatted and that the controller is correctly configured.
  // This is a bit of a hack, but it works for now. Clean up later when setting up e2e tests.

describe('UserController', () => {
  	let app: INestApplication;
	let controller: UserController;
	let userDataService: UserDataService;
	let config: ConfigService;
	let crypto: CryptoService;
	let http: HttpService;
	let jwt: JwtService;
	let baseUrl: string;
	let userRepo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule, // implicitly imports HttpService, adding service to providers array causes error
			],
			controllers: [UserController],
			providers: [
				ConfigService,
				{ // MergedStreamLogger
					provide: MergedStreamLogger,
					useValue: {
						registerMapper: jest.fn(),
						subscribeToStreams: jest.fn(),
						unsubscribeComponent: jest.fn(),
						unsubscribeAll: jest.fn(),
					}
				},								
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
				{ // Data service
					provide: UserDataService,
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
		}))
		/* TODO: shift to this more compact form when shifting from e2e to unit tests
		.overrideGuard(JwtAuthGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		.overrideGuard(RolesGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		.overrideGuard(LoggingGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		*/
		.compile();
		
		app = module.createNestApplication();
		controller = module.get<UserController>(UserController);
		userDataService = module.get<UserDataService>(UserDataService);
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
			let UserDataServiceCreateSpy: any;
			beforeEach(() => {
				requestConfig = { };
				userId = uuid();
				url = `${baseUrl}/${userId}`;
				UserDataServiceCreateSpy = jest.spyOn(userDataService, 'createUser').mockImplementation(() => Promise.resolve(userId));
			});

			afterEach(() => {
				UserDataServiceCreateSpy?.mockRestore();
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
				const UserDataServiceSpy = jest.spyOn(userDataService, 'createUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
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
				UserDataServiceSpy.mockRestore();
			});
		});

		describe('deleteUser', () => {
			let url: string;
			let userId: string;
			let UserDataServiceDeleteSpy: any;
			beforeEach(() => {
				userId = uuid();
				url = `${baseUrl}/${userId}`;
				UserDataServiceDeleteSpy = jest.spyOn(userDataService, 'deleteUser').mockImplementation(() => Promise.resolve());
			});

			afterEach(() => {
				UserDataServiceDeleteSpy?.mockRestore();
			});

			it('deletes a user and returns an empty success message', async () => {
				// arrange				
				// act
				const response = await lastValueFrom(http.delete(url, { headers }));
				
				// assert
				expect(UserDataServiceDeleteSpy).toHaveBeenCalledTimes(1);
				expect(UserDataServiceDeleteSpy).toHaveBeenCalledWith(adminContext, new EntityIdDTO(userId), true);
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
				expect(UserDataServiceDeleteSpy).toHaveBeenCalledWith(adminContext, new EntityIdDTO(userId), true);
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
				const UserDataServiceSpy = jest.spyOn(userDataService, 'deleteUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
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
				UserDataServiceSpy.mockRestore();
			});
		});

		describe('undeleteUser', () => {
			let requestConfig: any;
			let url: string;
			let userId: string;
			let UserDataServiceUndeleteSpy: any;
			beforeEach(() => {
				requestConfig = { };
				userId = uuid();
				url = `${baseUrl}/${userId}/undelete`;
				UserDataServiceUndeleteSpy = jest.spyOn(userDataService, 'undeleteUser').mockImplementation(() => Promise.resolve());
			});

			afterEach(() => {
				UserDataServiceUndeleteSpy?.mockRestore();
			});

			it('undeletes a user and returns an empty success message', async () => {
				// arrange				
				// act
				const response = await lastValueFrom(http.patch(url, requestConfig, { headers }));
				
				// assert
				expect(UserDataServiceUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(UserDataServiceUndeleteSpy).toHaveBeenCalledWith(adminContext, new EntityIdDTO(userId));
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
				const UserDataServiceSpy = jest.spyOn(userDataService, 'undeleteUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
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
				UserDataServiceSpy.mockRestore();
			});
		});
	});

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(controller.log$).toBeDefined();
				expect(controller.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(controller.logger).toBeDefined();
				expect(controller.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(controller.logToStream).toBeDefined();
				expect(typeof controller.logToStream).toBe('function');
			});
		});
	});
});
