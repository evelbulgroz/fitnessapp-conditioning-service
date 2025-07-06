import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';

import { of, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLogger } from '../../libraries/stream-loggable';

import BcryptCryptoService from '../../authentication/services/crypto/bcrypt-crypto.service';
import createTestingModule from '../../test/test-utils';
import CryptoService from '../../authentication/services/crypto/domain/crypto-service.model';
import JwtAuthGuard from '../../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../../infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from '../../authentication/services/jwt/jwt-secret.service';
import JwtService from '../../authentication/services/jwt/domain/jwt-service.model';
import JsonWebtokenService from '../../authentication/services/jwt/json-webtoken.service';
import SoftDeleteDTO from '../../shared/dtos/requests/soft-delete.dto';
import UserContext, { UserContextProps } from '../../shared/domain/user-context.model';
import UserController from '../../user/controllers/user.controller';
import UserJwtPayload from '../../authentication/services/jwt/domain/user-jwt-payload.model';
import UserRepository from '../../user/repositories/user.repo';
import UserDataService from '../services/user-data.service';
import UserIdDTO from '../../shared/dtos/requests/user-id.dto';

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// NOTE:
  // This unit test suite is designed to test the UserController and the logic supporting its endpoints.
  //
  // It mocks the UserDataService and other dependencies to isolate the controller's functionality.
  //
  // It calls controller methods directly, rather than over HTTP.
  // This allows for faster, more focused testing of the controller's logic without the overhead of HTTP requests.
  //
  // Since the controller methods are called directly, no guards or other decorators are applied to the methods.
  // This means that, e.g. access token validation and user role checks are not performed in this test suite.
  // Instead, these should be tested in e2e tests, where the controller is called over HTTP, activating all decorators and guards.

describe('UserController', () => {
  	// set up the testing module with the necessary imports, controllers, and providers
	let controller: UserController;
	let userDataService: UserDataService;
	let config: ConfigService;
	let crypto: CryptoService;
	let jwt: JwtService;
	let userRepo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
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
		.compile();
		
		controller = module.get<UserController>(UserController);
		userDataService = module.get<UserDataService>(UserDataService);
		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository>(UserRepository);
	});
  
	// set up test data
	let adminAccessToken: string;
	let adminUserCtx: UserContext;
	let adminMockRequest: any;
	let adminPayload: UserJwtPayload;
	let adminProps: UserContextProps;
	let isAdmin: boolean;
	let userId: EntityId;
	let userIdDTO: UserIdDTO;
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

		isAdmin = adminProps.roles!.includes('admin'); // true if user has admin role

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
		
		// set up mocks for requests from human user without admin rights

		userId = uuid() as EntityId; // generate a random user id for testing
		
		userProps = {
			userId,
			userName: 'testuser', // i.e. not the requesting service
			userType: 'user',
			roles: ['user'],
		};

		userIdDTO = new UserIdDTO(userProps.userId);		
	});

	// set up spies for user repository methods
	let userRepoFetchByIdSpy: any;
	beforeEach(() => {
		userRepoFetchByIdSpy = jest.spyOn(userRepo, 'fetchById')
			.mockImplementation(() => Promise.resolve(Result.ok(of({entityId: adminUserCtx.userId} as any))));
	});
		  
	afterEach(() => {
		userRepoFetchByIdSpy?.mockRestore();
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

		describe('deleteUser', () => {
			let softDelete: boolean;
			let userId: string;
			let userDataServiceDeleteSpy: any;
			beforeEach(() => {
				softDelete = true; // default to soft delete
				userId = uuid();
				userDataServiceDeleteSpy = jest.spyOn(userDataService, 'deleteUser')
					.mockImplementation((requestingServiceName: string,	userId: EntityId, softDelete?: boolean, isAdmin?: boolean) => {
						void requestingServiceName, userId, softDelete, isAdmin; // suppress unused parameter warnings
						return Promise.resolve()
					});
			});

			afterEach(() => {
				userDataServiceDeleteSpy?.mockRestore();
			});

			it('deletes a user and returns an empty success message', async () => {
				// arrange				
				// act
				void await controller.deleteUser(
					adminMockRequest,
					new UserIdDTO(userId),
					new SoftDeleteDTO(true) // soft delete
				);
				
				// assert
				expect(userDataServiceDeleteSpy).toHaveBeenCalledTimes(1);
				expect(userDataServiceDeleteSpy).toHaveBeenCalledWith(requestingServiceName, userId, softDelete, isAdmin);
			});

			it('by default performs a soft delete', async () => {
				// arrange
				// act
				void await controller.deleteUser(
					adminMockRequest,
					new UserIdDTO(userId),
					// soft delete is true by default
				);
				
				// assert
				expect(userDataServiceDeleteSpy).toHaveBeenCalledTimes(1);
				expect(userDataServiceDeleteSpy).toHaveBeenCalledWith(requestingServiceName, userId, softDelete, isAdmin);
			});

			it('optionally performs a hard delete', async () => {
				// arrange
				void await controller.deleteUser(
					adminMockRequest,
					new UserIdDTO(userId),
					new SoftDeleteDTO(false) // hard delete
				);

				// act/assert
				expect(userDataServiceDeleteSpy).toHaveBeenCalledWith(requestingServiceName, userId, false, isAdmin);
			});

			it('throws error if user id is missing', async () => {
				// arrange
				const deletePromise = controller.deleteUser(
					adminMockRequest,
					undefined as any, // intentionally passing undefined to simulate missing user id
					// soft delete defaults to true
				);

				// act/assert
				expect(async () => await deletePromise).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				const deletePromise = controller.deleteUser(
					adminMockRequest,
					null as any, // intentionally passing null to simulate invalid user id
					// soft delete defaults to true
				);

				// act/assert
				expect(async () => await deletePromise).rejects.toThrow();
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
				
				const deletePromise = controller.deleteUser(
					adminMockRequest,
					new UserIdDTO(userId),
					// soft delete defaults to true
				);

				// act/assert
				expect(async () => await deletePromise).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				
				userDataServiceDeleteSpy?.mockRestore(); // clean up previous spy
				userDataServiceDeleteSpy = jest.spyOn(userDataService, 'deleteUser')
					.mockImplementation(() => Promise.reject(new Error(errorMessage)));
				
				const deletePromise = controller.deleteUser(
					adminMockRequest,
					new UserIdDTO(userId),
					// soft delete defaults to true
				);

				// act/assert
				expect(async () => await deletePromise).rejects.toThrow(errorMessage);

				// clean up
				userDataServiceDeleteSpy.mockRestore();
			});
		});

		describe('undeleteUser', () => {
			let requestConfig: any;
			let userDataServiceUndeleteSpy: any;
			beforeEach(() => {
				requestConfig = { };
				userDataServiceUndeleteSpy = jest.spyOn(userDataService, 'undeleteUser')
					.mockImplementation(() => Promise.resolve());
			});

			afterEach(() => {
				userDataServiceUndeleteSpy?.mockRestore();
			});

			it('undeletes a user and returns an empty success message', async () => {
				// arrange				
				// act
				const result = await controller.undeleteUser(
					adminMockRequest,
					userIdDTO
				);
				
				// assert
				expect(userDataServiceUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(userDataServiceUndeleteSpy).toHaveBeenCalledWith(requestingServiceName, userIdDTO.userId, isAdmin);
				expect(result).toBeUndefined();
			});

			it('throws error if user id is missing', async () => {
				// arrange
				const undeletePromise = controller.undeleteUser(
					adminMockRequest,
					undefined as any, // intentionally passing undefined to simulate missing user id
				);

				// act/assert
				expect(async () => await undeletePromise).rejects.toThrow();
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				const undeletePromise = controller.undeleteUser(
					adminMockRequest,
					null as any, // intentionally passing null to simulate invalid user id
				);

				// act/assert
				expect(async () => await undeletePromise).rejects.toThrow();
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

				const undeletePromise = controller.undeleteUser(
					adminMockRequest,
					userIdDTO,
					// soft delete defaults to true
				);			
				
				// act/assert
				expect(async () => await undeletePromise).rejects.toThrow();
			});

			it('throws error if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				
				userDataServiceUndeleteSpy?.mockRestore(); // clean up previous spy
				userDataServiceUndeleteSpy = jest.spyOn(userDataService, 'undeleteUser')
					.mockImplementation(() => Promise.reject(new Error(errorMessage)));
				
				const undeletePromise = controller.undeleteUser(
					adminMockRequest,
					userIdDTO,
					// soft delete defaults to true
				);
				
				// act/assert
				expect(async () => await undeletePromise).rejects.toThrow(errorMessage);
				

				// clean up
				userDataServiceUndeleteSpy.mockRestore();
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
