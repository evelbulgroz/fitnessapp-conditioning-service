import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { HttpService, HttpModule } from '@nestjs/axios';

import { lastValueFrom, of, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLogger } from '../../libraries/stream-loggable';

import BcryptCryptoService from '../../authentication/services/crypto/bcrypt-crypto.service';
import createTestingModule from '../../test/test-utils';
import CryptoService from '../../authentication/services/crypto/domain/crypto-service.model';
import EntityIdDTO from '../../shared/dtos/requests/entity-id.dto';
import JwtAuthGuard from '../../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../../infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from '../../authentication/services/jwt/jwt-secret.service';
import JwtService from '../../authentication/services/jwt/domain/jwt-service.model';
import JsonWebtokenService from '../../authentication/services/jwt/json-webtoken.service';
import UserContext, { UserContextProps } from '../../shared/domain/user-context.model';
import UserController from '../../user/controllers/user.controller';
import UserJwtPayload from '../../authentication/services/jwt/domain/user-jwt-payload.model';
import UserRepository from '../../user/repositories/user.repo';
import UserDataService from '../services/user-data.service';
import ValidationPipe from '../../infrastructure//pipes/validation.pipe';
import UserIdDTO from '../../shared/dtos/requests/user-id.dto';

// NOTE:
  // Testing over http to enable decorators and guards without having to do a ton of additional setup/mocking.
  // This also ensures request/response objects are correctly formatted and that the controller is correctly configured.
  // This is a bit of a hack, but it works for now. Clean up later when setting up e2e tests.

describe('UserController', () => {
  	// Set up the testing module with the necessary imports, controllers, and providers
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
  
	// set up test data
	let adminAccessToken: string;
	let adminUserCtx: UserContext;
	let adminMockRequest: any;
	let adminPayload: UserJwtPayload;
	let adminProps: UserContextProps;
	let userAccessToken: string;
	let adminHeaders: any;
	let userId: EntityId;
	let userIdDTO: UserIdDTO;
	let userContext: UserContext;
	let userHeaders: any;
	let userMockRequest: any;
	let userPayload: UserJwtPayload;
	let userProps: UserContextProps;
	let requestingServiceName: string;
	beforeEach(async () => {
		// set mocks for request from user microservice with admin rights
		
		requestingServiceName = config.get<string>('security.collaborators.user.serviceName')!;
		
		adminProps = {
			userId: uuid(),
			userName: requestingServiceName,
			userType: 'user',
			roles: ['admin'],
		};

		adminUserCtx = new UserContext(adminProps);
  
		adminPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: adminUserCtx.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: adminUserCtx.userName,
			subType: adminUserCtx.userType as any,
			roles: adminUserCtx.roles,
		};
  
		adminAccessToken = await jwt.sign(adminPayload);

		adminMockRequest = {
			headers: { Authorization: `Bearer ${adminAccessToken}` },
			user: adminProps, // mock user object
		};
		
		adminHeaders = { Authorization: `Bearer ${adminAccessToken}` };
		
		// set up mocks for requests from human user without admin rights
		
		userProps = {
			userId: uuid(),
			userName: 'testuser', // i.e. not the requesting service
			userType: 'user',
			roles: ['user'],
		};

		userContext = new UserContext(userProps);

		userPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: userContext.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: userContext.userName,
			subType: userContext.userType,
			roles: userContext.roles,
		};		

		userAccessToken = await jwt.sign(userPayload);

		userMockRequest = {
			headers: { Authorization: `Bearer ${userAccessToken}` },
			user: userProps, // mock user object
		};

		userHeaders = { Authorization: `Bearer ${userAccessToken}` };

		userIdDTO = new UserIdDTO(userProps.userId);		
	});

	// set up spies for user repository methods
	let userRepoFetchByIdSpy: any;
	beforeEach(() => {
		userRepoFetchByIdSpy = jest.spyOn(userRepo, 'fetchById')
			.mockImplementation(() => Promise.resolve(Result.ok(of({entityId: adminUserCtx.userId} as any))));
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
			let UserDataServiceCreateSpy: any;
			beforeEach(() => {
				UserDataServiceCreateSpy = jest.spyOn(userDataService, 'createUser')
				.mockImplementation(() => Promise.resolve(userProps.userId));
			});

			afterEach(() => {
				UserDataServiceCreateSpy?.mockRestore();
			});

			it('creates a new user and returns an empty success message', async () => {
				// arrange
				// act
				void await controller.createUser(
					adminMockRequest,
					userIdDTO,		
				);

				// assert
				expect(UserDataServiceCreateSpy).toHaveBeenCalledTimes(1);
				expect(UserDataServiceCreateSpy).toHaveBeenCalledWith(adminUserCtx.userName, userIdDTO.value, true);
			});

			it('throws error if user id is missing', async () => {
				// arrange
				// act
				const createPromise = controller.createUser(
					adminMockRequest,
					undefined as any, // intentionally passing undefined to simulate missing user id		
				);
				
				// assert
				expect(async () => await createPromise).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				// act
				 const createPromise = controller.createUser(
					adminMockRequest,
					null as any, // intentionally passing null to simulate invalid user id		
				);

				// assert
				expect(async () => await createPromise).rejects.toThrow();
			});

			it('throws error if requester is not user microservice', async () => {
				// arrange
				adminProps.userName = 'invalid'; // simulate a non-user microservice request
				adminPayload.subName = 'invalid';
				adminAccessToken = await jwt.sign(adminPayload);
				adminMockRequest = {
					headers: { Authorization: `Bearer ${adminAccessToken}` },
					user: adminProps, // mock user object
				};

				// act
				const createPromise = controller.createUser(
					adminMockRequest,
					userIdDTO,		
				);

				// assert
				expect(async () => await createPromise).rejects.toThrow();
			});

			it(`throws error if requester is not authorized to create user (i.e. not admin)`, async () => {
				// arrange
				const nonAdminProps: UserContextProps = {...adminProps, roles: ['user']}; // simulate a non-admin user
				const nonAdminUserCtx: UserContext = new UserContext(nonAdminProps);		
				const nonAdminPayload: UserJwtPayload = {...adminPayload, sub: nonAdminUserCtx.userId as string, roles: nonAdminProps.roles };
				const nonAdminAccessToken: string = await jwt.sign(nonAdminPayload);
				const nonAdminMockRequest: any = {
					headers: { Authorization: `Bearer ${nonAdminAccessToken}` },
					user: nonAdminProps, // mock user object
				};
				
				// act
				const createPromise = controller.createUser(
					nonAdminMockRequest,
					userIdDTO,		
				);
				// assert
				expect(async () => await createPromise).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const UserDataServiceSpy = jest.spyOn(userDataService, 'createUser')
					.mockImplementation(() => Promise.reject(new Error(errorMessage)));
				
				// act/assert
				 // jest can't catch errors thrown in async functions, so we have to catch it ourselves
				let error: any;
				try {
					void await controller.createUser(
						adminMockRequest,
						userIdDTO,		
					);
				}
				catch (e) {
					error = e;					
				}
				expect(error).toBeDefined();

				// clean up
				UserDataServiceSpy.mockRestore();
			});
		});

		xdescribe('deleteUser', () => {
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
				const response = await lastValueFrom(http.delete(url, { headers: adminHeaders }));
				
				// assert
				expect(UserDataServiceDeleteSpy).toHaveBeenCalledTimes(1);
				expect(UserDataServiceDeleteSpy).toHaveBeenCalledWith(adminUserCtx, new EntityIdDTO(userId), true);
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
			});

			xit('by default performs a soft delete', async () => {
				// arrange
				const response = await lastValueFrom(http.delete(url, { headers: adminHeaders }));

				// act
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
			});

			xit('optionally performs a hard delete', async () => {
				// arrange
				const response = await lastValueFrom(http.delete(url + '?softDelete=true', { headers: adminHeaders, }));

				// act
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
				expect(UserDataServiceDeleteSpy).toHaveBeenCalledWith(adminUserCtx, new EntityIdDTO(userId), true);
			});

			xit('throws error if user id is missing', async () => {
				// arrange
				const response$ = http.delete(baseUrl, { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			xit('throws error if user id is invalid', async () => {
				// arrange
				const response$ = http.delete(baseUrl + '/invalid', { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			xit('throws error if requester is not user microservice', async () => {
				// arrange
				adminPayload.subName = 'invalid';
				adminAccessToken = await jwt.sign(adminPayload);
				adminHeaders = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.delete(url, { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			xit(`throws if requester is not authorized to delete user (i.e. not admin)`, async () => {
				// arrange
				adminHeaders = { Authorization: `Bearer ${userAccessToken}` };
				const response$ = http.delete(url, { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			xit('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const UserDataServiceSpy = jest.spyOn(userDataService, 'deleteUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
				const response$ = http.delete(url, { headers: adminHeaders });

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

		xdescribe('undeleteUser', () => {
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
				const response = await lastValueFrom(http.patch(url, requestConfig, { headers: adminHeaders }));
				
				// assert
				expect(UserDataServiceUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(UserDataServiceUndeleteSpy).toHaveBeenCalledWith(adminUserCtx, new EntityIdDTO(userId));
				expect(response.status).toBe(204);
				expect(response.data).toBe('');
			});

			it('throws a BadRequestException if access token is missing', async () => {
				// arrange
				adminHeaders = {};
				const response$ = http.patch(url, requestConfig, adminHeaders);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if access token is invalid', async () => {
				// arrange
				adminHeaders = { Authorization: `Bearer invalid` };
				const response$ = http.patch(url, requestConfig, adminHeaders);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user information in token payload is invalid', async () => {
				// arrange
				adminPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				adminAccessToken = await jwt.sign(adminPayload);
				adminHeaders = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.patch(url, { headers: adminHeaders } );

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is missing', async () => {
				// arrange
				const response$ = http.patch(baseUrl, { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				const response$ = http.patch(baseUrl + '/invalid', { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if requester is not user microservice', async () => {
				// arrange
				adminPayload.subName = 'invalid';
				adminAccessToken = await jwt.sign(adminPayload);
				adminHeaders = { Authorization: `Bearer ${adminAccessToken}` };
				const response$ = http.patch(url, { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it(`throws if requester is not authorized to undelete user (i.e. not admin)`, async () => {
				// arrange
				adminHeaders = { Authorization: `Bearer ${userAccessToken}` };
				const response$ = http.patch(url, { headers: adminHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const UserDataServiceSpy = jest.spyOn(userDataService, 'undeleteUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
				const response$ = http.patch(url, requestConfig, { headers: adminHeaders });

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

	xdescribe('Logging API', () => {
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
