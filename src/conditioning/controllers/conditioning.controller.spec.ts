import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, INestApplication } from '@nestjs/common';

import { jest } from '@jest/globals';
import { of, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLogger } from '../../libraries/stream-loggable';

import { AggregationQueryDTO, AggregationQueryDTOProps } from '../dtos/aggregation-query.dto';
import BcryptCryptoService from '../../authentication/services/crypto/bcrypt-crypto.service';
import ConditioningController from './conditioning.controller';
import ConditioningDataService from '../services/conditioning-data/conditioning-data.service';
import ConditioningLog from '../domain/conditioning-log.entity';
import ConditioningLogDTO from '../dtos/conditioning-log.dto';
import { createTestingModule } from '../../test/test-utils';
import CryptoService from '../../authentication/services/crypto/domain/crypto-service.model';
import DomainTypeDTO from '../../shared/dtos/responses/domain-type.dto';
import JwtAuthGuard from '../../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../../infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from '../../authentication/services/jwt/jwt-secret.service';
import JwtService from '../../authentication/services/jwt/domain/jwt-service.model';
import JsonWebtokenService from '../../authentication/services/jwt/json-webtoken.service';
import LogIdDTO from '../../shared/dtos/requests/log-id.dto';
import { QueryDTO, QueryDTOProps } from '../../shared/dtos/responses/query.dto';
import { UserContext, UserContextProps } from '../../shared/domain/user-context.model';
import UserJwtPayload from '../../authentication/services/jwt/domain/user-jwt-payload.model';
import UserIdDTO from '../../shared/dtos/requests/user-id.dto';
import UserRepository from '../../user/repositories/user.repo';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';
import IncludeDeletedDTO from '../../shared/dtos/requests/include-deleted.dto';
import e, { query } from 'express';

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// NOTE:
  // This unit test suite is designed to test the ConditioningController and the logic supporting its endpoints.
  //
  // It mocks the ConditioningDataService and other dependencies to isolate the controller's functionality.
  //
  // It calls controller methods directly, rather than over HTTP.
  // This allows for faster, more focused testing of the controller's logic without the overhead of HTTP requests.
  //
  // Since the controller methods are called directly, no guards or other decorators are applied to the methods.
  // This means that, e.g. access token validation and user role checks are not performed in this test suite.
  // Instead, these should be tested in e2e tests, where the controller is called over HTTP, activating all decorators and guards.

describe('ConditioningController', () => {
	let app: INestApplication;
	let controller: ConditioningController;
	let service: ConditioningDataService;
	let config: ConfigService;
	let crypto: CryptoService;
	let jwt: JwtService;
	let baseUrl: string;
	let userRepo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			controllers: [ConditioningController],
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
					provide: ConditioningDataService,
					useValue: {
						fetchActivityCounts: jest.fn(),
						fetchAggretagedLogs: jest.fn(),
						conditioningData: jest.fn(),
						createLog: jest.fn(),
						fetchLog: jest.fn(),
						fetchLogs: jest.fn(),
						fetchAdminLogs: jest.fn(),
						fetchUserLogs: jest.fn(),
						deleteLog: jest.fn(),
						getByQuery: jest.fn(),
						updateLog: jest.fn(),
						undeleteLog: jest.fn(),						
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
		
		app = module.createNestApplication();
		controller = module.get<ConditioningController>(ConditioningController);
		service = module.get<ConditioningDataService>(ConditioningDataService);
		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository>(UserRepository);

		app.useGlobalPipes(new ValidationPipe());
		await app.listen(0); // enter 0 to let the OS choose a free port

		const port = app?.getHttpServer()?.address()?.port; // random port, e.g. 60703
		baseUrl = `http://localhost:${port}/conditioning`; // prefix not applied during testing, so omit it
	});

	let adminAccessToken: string;
	let adminMockRequest: any; // mock request object for testing purposes
	let adminPayload: UserJwtPayload;
	let adminProps: UserContextProps;
	let adminUserCtx: UserContext;
	let adminUserId: EntityId;
	let adminUserIdDTO: UserIdDTO;
	let userAccessToken: string;
	let userContxt: UserContext;
	let userId: EntityId;
	let userIdDTO: UserIdDTO;
	let userMockRequest: any; // mock request object for testing purposes
	let userPayload: UserJwtPayload;
	let userProps: UserContextProps;
	let userRepoSpy: any;
	beforeEach(async () => {
		adminUserId = uuid();

		adminUserIdDTO = new UserIdDTO(adminUserId);

		adminProps = {
			userId: adminUserId,
			userName: 'adminuser',
			userType: 'user',
			roles: ['admin'],
		};

		adminPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: adminProps.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			//exp: Math.floor(new Date('2100-01-01').getTime() / 1000), // far in the future (for manual testing)
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: adminProps.userName,
			subType: adminProps.userType as any,
			roles: ['admin'],
		};

		adminAccessToken = await jwt.sign(adminPayload);

		adminUserCtx = new UserContext(adminProps);

		adminMockRequest = {
			headers: { Authorization: `Bearer ${adminAccessToken}` },
			user: adminProps, // mock user object
		};

		userId = uuid(); // generate a random user id for testing

		userIdDTO = new UserIdDTO(userId);

		userProps = {
			userId: userId,
			userName: 'user',
			userType: 'user',
			roles: ['user'],
		};

		userContxt = new UserContext(userProps);

		userMockRequest = {
			headers: { Authorization: `Bearer ${userAccessToken}` },
			user: userProps, // mock user object
		};

		userPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: userContxt.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: userContxt.userName,
			subType: userContxt.userType,
			roles: ['user'],
		};

		userAccessToken = await jwt.sign(userPayload);

		userRepoSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => Promise.resolve(Result.ok(of({entityId: userContxt.userId} as any))));
	});

	afterEach(() => {
		app.close();
		userRepoSpy && userRepoSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(controller).toBeDefined();
	});

	describe('Endpoints', () => {
		describe('activities', () => {
			let expectedQueryDTO: QueryDTO;
			beforeEach(() => {
				const queryDTOProps: QueryDTOProps = {					
					start: '2025-01-01T00:00:00Z',
					end: '2025-01-31T23:59:59Z',
					activity: ActivityType.RUN,
					// should not include duplicate userId, or request will fail
					sortBy: 'date',
					order: 'ASC',
					page: 1,
					pageSize: 10
				};				
				expectedQueryDTO = new QueryDTO(queryDTOProps);
				const queryString = Object.keys(queryDTOProps).map(key => `${key}=${(queryDTOProps as any)[key]}`).join('&');
			});

			afterEach(() => {
				jest.clearAllMocks();
			});
			
			it('provides summary of conditioning activities performed by type', async () => {
				// arrange
				const includeDeletedDTO = new IncludeDeletedDTO(false);
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts');
				
				// act
				void await controller.activities(
					userMockRequest,
					userIdDTO,
					includeDeletedDTO,
					expectedQueryDTO,
				);
				
				// assert
				expect(serviceSpy).toHaveBeenCalledTimes(1);
				expect(serviceSpy).toHaveBeenCalledWith(
					userContxt.userId, // user context
					userId, // user id
					expectedQueryDTO, // query
					userContxt.roles.includes('admin'), // isAdmin
					includeDeletedDTO.value, // include deleted
				);

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called without a user id', async () => {
				// arrange
				const includeDeletedDTO = new IncludeDeletedDTO(false);
				const mockRequest = {
					headers: { Authorization: `Bearer ${userAccessToken}` },
					user: userProps,
				};
				
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts');
				
				// act
				void await controller.activities(
					mockRequest,
					/* no user id */ undefined,
					includeDeletedDTO,
					expectedQueryDTO,
				);
				
				// assert
				expect(serviceSpy).toHaveBeenCalledTimes(1);
				expect(serviceSpy).toHaveBeenCalledWith(
					userContxt.userId, // user context
					undefined, // user id
					expectedQueryDTO, // query
					userContxt.roles.includes('admin'), // isAdmin
					includeDeletedDTO.value, // include deleted
				);

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called with without includeDeleted', async () => {
				// arrange
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts');				
				
				// act
				void await controller.activities(
					userMockRequest,
					new UserIdDTO(userContxt.userId),
					undefined, // no includeDeleted
					expectedQueryDTO,
				);
				
				// assert
				expect(serviceSpy).toHaveBeenCalledTimes(1);
				expect(serviceSpy).toHaveBeenCalledWith(
					userContxt.userId, // user context
					userId, // user id
					expectedQueryDTO, // query
					userContxt.roles.includes('admin'), // isAdmin
					undefined // include deleted omitted
				);

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called with without a query', async () => {
				// arrange
				const includeDeletedDTO = new IncludeDeletedDTO(false);				
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts');				
				
				// act/assert
				void await controller.activities(
					userMockRequest,
					new UserIdDTO(userContxt.userId),
					includeDeletedDTO,
					undefined, // no query
				);
				
				// assert
				expect(serviceSpy).toHaveBeenCalledTimes(1);
				expect(serviceSpy).toHaveBeenCalledWith(
					userContxt.userId, // user context
					userId, // user id
					undefined, // query
					userContxt.roles.includes('admin'), // isAdmin
					includeDeletedDTO.value, // include deleted
				);

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called without any query parameters', async () => {
				// arrange
				
				// act/assert
				await expect(controller.activities(userMockRequest)).resolves.not.toThrow();
			});			

			it('throws if data service throws', async () => {
				// arrange
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts')
					.mockImplementation(() => { throw new Error('Test Error'); });
				
				// act/assert
				await expect(controller.activities(userMockRequest)).rejects.toThrow();

				// clean up
				serviceSpy?.mockRestore();
			});
		});

		describe('aggregate', () => {
			let aggregationSpy: any;
			let adminLogs: any[];
			let userLogs: any[];
			let aggregationQueryDTO: AggregationQueryDTO;
			let aggregationQueryDTOProps: AggregationQueryDTOProps;
			let queryDTOProps: QueryDTOProps;
			let queryDTO: QueryDTO;
			beforeEach(() => {
				adminLogs = [
					{ activity: 'RUN' },
					{ activity: 'RUN' },
					{ activity: 'RUN' },
				] as any[];

				userLogs = [
					{ activity: 'SWIM' },
					{ activity: 'BIKE' },
					{ activity: 'RUN' },
					{ activity: 'MTB' },
					{ activity: 'MTB' },
				] as any[];
				
				jest.clearAllMocks();
				aggregationSpy = jest.spyOn(service, 'fetchAggretagedLogs')
					.mockImplementation((requestingUserId: EntityId, aggregationQueryDTO: AggregationQueryDTO, queryDTO?: QueryDTO, isAdmin?: boolean, includeDeleted?: boolean) => {
						if (isAdmin) { // simulate an admin user requesting logs
							return Promise.resolve(adminLogs as any)
						}
						else { // simulate a normal user requesting logs
							return Promise.resolve(userLogs as any)
						}
						/*
						else { // simulate a user without any roles
							throw new ForbiddenException('User not authorized to access logs'); // throw an error
						}*/
					});

				aggregationQueryDTOProps = { // body of request
					"aggregatedType": "ConditioningLog",
					"aggregatedProperty": "duration",
					"aggregationType": "SUM",
					"sampleRate": "DAY",
					"aggregatedValueUnit": "ms"
				};

				aggregationQueryDTO = new AggregationQueryDTO(aggregationQueryDTOProps);

				queryDTOProps = { // query parameters for request
					start: '2021-01-01',
					end: '2021-12-31',
					activity: ActivityType.MTB,
					userId: userContxt.userId as unknown as string,
					sortBy: 'duration',
					order: 'ASC',
					page: 1,
					pageSize: 10,
				};

				queryDTO = new QueryDTO(queryDTOProps);
			});

			afterEach(() => {
				aggregationSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('gives non-admin users access to aggregate a collection of all their own conditioning logs', async () => {
				// arrange				
				// act
				const result = await controller.aggregate(
					userMockRequest,
					aggregationQueryDTO,
					undefined // no query
				);
				
				// assert
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				expect(aggregationSpy).toHaveBeenCalledWith(
					userContxt.userId, // user context
					aggregationQueryDTO, // aggregation query
					undefined, // no query
					// isAdmin
					// includeDeleted
				);
								
				expect(result).toBeDefined();
				expect(result).toEqual(userLogs);
			});

			it('optionally gives non-admin users access to aggregate their own logs matching a query', async () => {
				// arrange				
				// act
				const result = await controller.aggregate(
					userMockRequest,
					aggregationQueryDTO,
					queryDTO // pass query
				);
				
				// assert
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				expect(aggregationSpy).toHaveBeenCalledWith(
					userContxt.userId, // user context
					aggregationQueryDTO, // aggregation query
					queryDTO, // no query
					// isAdmin
					// includeDeleted
				);

				expect(result).toBeDefined();
				expect(result).toEqual(userLogs);
			});

			it('gives admin users access to aggregate a collection of all logs for all users', async () => {
				// arrange
				// act
				const result = await controller.aggregate(
					adminMockRequest,
					aggregationQueryDTO,
					undefined // no query
				);

				// assert
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				expect(aggregationSpy).toHaveBeenCalledWith(
					adminUserCtx.userId, // user context
					aggregationQueryDTO, // aggregation query
					undefined, // no query
					// isAdmin
					// includeDeleted
				);
			});

			it('optionally gives admin users access to aggregate logs matching a query', async () => {
				// arrange
				queryDTOProps.userId = adminUserCtx.userId as unknown as string; // set userId to admin user id
				queryDTO = new QueryDTO(queryDTOProps); // create query DTO with userId set to admin user id

				// act
				const result = await controller.aggregate(
					adminMockRequest,
					aggregationQueryDTO,
					queryDTO // pass query
				);

				// assert
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				expect(aggregationSpy).toHaveBeenCalledWith(
					adminUserCtx.userId, // user context
					aggregationQueryDTO, // aggregation query
					queryDTO, // query
					// isAdmin
					// includeDeleted
				);

				expect(result).toBeDefined();
				expect(result).toEqual(userLogs);
			});

			it('throws if data service rejects', async () => {
				// arrange
				aggregationSpy.mockRestore();
				aggregationSpy = jest.spyOn(service, 'fetchAggretagedLogs')
					.mockImplementation(() => { return Promise.reject(new Error('Aggregation query failed')); });

				// act/assert
				await expect(controller.aggregate(userMockRequest, aggregationQueryDTO)).rejects.toThrow();

				// clean up
				aggregationSpy?.mockRestore();
			});

			it('throws if data service throws', async () => {
				// arrange
				aggregationSpy.mockRestore();
				aggregationSpy = jest.spyOn(service, 'fetchAggretagedLogs')
					.mockImplementation(() => { throw new Error('Test Error'); });

				// act/assert
				await expect(controller.aggregate(userMockRequest, aggregationQueryDTO)).rejects.toThrow();

				// clean up
				aggregationSpy?.mockRestore();
			});

			// Aggregation query validation is handled by the DTO validation pipe, so defer this test to e2e tests

			// Props whitelist is handled by the DTO validation pipe, so defer this test to e2e tests

			// Query validation is handled by the DTO validation pipe, so defer this test to e2e tests

			// Roles validation is handled by the JWT auth guard, so defer this test to e2e tests
		});

		describe('logs', () => {
			describe('single log', () => {
				describe('createLog', () => {
					let sourceLogDto: ConditioningLogDTO;
					let sourceLog : ConditioningLog<any, ConditioningLogDTO>;
					let serviceSpy: any;
					let newLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						newLogId = uuid();
						sourceLog = ConditioningLog.create({
							activity: ActivityType.SWIM,
							isOverview: true,
							duration: { value: 3600, unit: 's' },
							className: 'ConditioningLog'
						}).value as ConditioningLog<any, ConditioningLogDTO>;
						sourceLogDto = sourceLog.toDTO();

						serviceSpy = jest.spyOn(service, 'createLog')
							.mockImplementation((ctx: any, userId: EntityId, log: ConditioningLog<any,ConditioningLogDTO>) => {
								void ctx, userId, log; // suppress unused variable warning
								return Promise.resolve(newLogId); // return the log
							});

						urlPath = `${baseUrl}/log/`;
						url = urlPath + userContxt.userId;
					});

					afterEach(() => {
						serviceSpy && serviceSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('creates a new conditioning log for a user and returns its unique id', async () => {
						// arrange						
						// act
						const result = await controller.createLog(
							userMockRequest,
							userIdDTO,
							sourceLogDto
						);
						
						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						
						const params = serviceSpy.mock.calls[0];
						const [requestingId, targetId, logData, isAdmin] = params;
						
						expect(requestingId).toEqual(userContxt.userId);
						expect(targetId).toEqual(userId);
						// Check only a sample of log properties
						expect(logData.activity).toEqual(sourceLog.activity);
						expect(logData.activityOrder).toEqual(sourceLog.activityOrder);
						expect(logData.constructor.name).toEqual(sourceLog.constructor.name);
						expect(logData.isOverview).toEqual(sourceLog.isOverview);						
						expect(isAdmin).toEqual(userContxt.roles.includes('admin'));
						
						expect(result).toEqual(newLogId);
					});

					it('throws if user id is missing', async () => {
						// arrange
						userMockRequest.user = undefined; // simulate missing user id in request

						// act/assert
						expect(async () => await controller.createLog(userMockRequest, undefined as any, sourceLogDto)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant user id to the data service, so this test is not needed

					it('throws if log data is missing', async () => {
						// arrange						
						// act/assert
						expect(async () => await controller.createLog(userMockRequest, userIdDTO, undefined as any)).rejects.toThrow();
					});

					it('throws if log data is invalid', async () => {
						// arrange
						// act/assert
						expect(async () => await controller.createLog(userMockRequest, userIdDTO, { activity: 'invalid' } as any)).rejects.toThrow();
					});

					it('throws if data service rejects', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'createLog').mockImplementation(() => { return Promise.reject(new Error('Log not created')); });
						
						// act/assert
						await expect(controller.createLog(userMockRequest, userIdDTO, sourceLogDto)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});

					it('throws if data service throws', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'createLog').mockImplementation(() => { throw new Error('Test Error'); });
						
						// act/assert
						await expect(controller.createLog(userMockRequest, userIdDTO, sourceLogDto)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});
				});

				describe('fetchLog', () => {
					let log: ConditioningLog<any, ConditioningLogDTO>;
					let logId: EntityId;
					let logIdDTO: LogIdDTO;
					let serviceSpy: any;
					beforeEach(() => {
						log = { activity: 'SWIM' } as unknown as ConditioningLog<any, ConditioningLogDTO>;
						logId = uuid();
						logIdDTO = new LogIdDTO(logId);
						serviceSpy = jest.spyOn(service, 'fetchLog')
							.mockImplementation((
								requestingUserId: EntityId,
								targetUserId: EntityId,
								logId: EntityId,
								isAdmin: boolean = false,
								includeDeleted: boolean = false
							) => {
								void requestingUserId, targetUserId, logId, isAdmin, includeDeleted; // suppress unused variable warning
								if (isAdmin) { // simulate an admin user requesting a log
									return Promise.resolve(log); // return the log (admins can access all logs)
								}
								else { // simulate a normal user requesting a log
									if (requestingUserId === targetUserId) { // simulate a normal user requesting their own log
										return Promise.resolve(log); // return the log
									}
									else { // simulate a normal user requesting another user's log
										throw new ForbiddenException('User not authorized to access log'); // throw an error
									}
								}
								/*else { // simulate a user without any roles
									throw new ForbiddenException('User not authorized to access log'); // throw an error
								}*/				
						});
					});

					afterEach(() => {
						serviceSpy?.mockRestore();
						jest.clearAllMocks();
					});
					
					it('provides a detailed conditioning log', async () => {
						// arrange
						// act
						const result = await controller.fetchLog(
							userMockRequest,
							userIdDTO,
							logIdDTO
						);

						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						expect(serviceSpy).toHaveBeenCalledWith(
							userContxt.userId, // user context
							userId, // user id
							logId, // log id
							userContxt.roles.includes('admin'), // isAdmin
							false // include deleted
						);
						
						expect(result).toBeDefined();
					});					

					it('throws if user id is missing', async () => {
						// arrange
						userMockRequest.user = undefined; // simulate missing user id in request

						// act/assert
						expect(async () => await controller.fetchLog(userMockRequest, undefined as any, logIdDTO, )).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant user id to the data service, so this test is not needed

					it('throws if log id is missing', async () => {
						// arrange
						// act/assert
						expect(async () => await controller.fetchLog(userMockRequest, userIdDTO, undefined as any)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant log id to the data service, so this test is not needed

					it('throws if data service rejects', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'fetchLog').mockImplementation(() => { return Promise.reject(new Error('Log not found')); });

						// act/assert
						expect(async () => await controller.fetchLog(userMockRequest, userIdDTO, logIdDTO)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});

					it('throws if data service throws', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'fetchLog').mockImplementation(() => { throw new Error('Test Error'); });

						// act/assert
						expect(async () => await controller.fetchLog(userMockRequest, userIdDTO, logIdDTO)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});
				});

				describe('updateLog', () => {
					let serviceSpy: any;
					let updatedLogDto: ConditioningLogDTO;
					let updatedLog: ConditioningLog<any, ConditioningLogDTO>;
					let updatedLogId: EntityId;
					let updatedLogIdDTO: LogIdDTO;
					beforeEach(() => {
						updatedLogId = uuid();
						updatedLogIdDTO = new LogIdDTO(updatedLogId);
						updatedLog = ConditioningLog.create({
							activity: ActivityType.SWIM,
							isOverview: true,
							duration: { value: 3600, unit: 's' },
							className: 'ConditioningLog'
						}).value as ConditioningLog<any, ConditioningLogDTO>;
						updatedLogDto = updatedLog.toDTO();

						serviceSpy = jest.spyOn(service, 'updateLog')
							.mockImplementation((
								requestingUserId: EntityId,
									targetUserId: EntityId,
									logId: EntityId,
									log: Partial<ConditioningLog<any, ConditioningLogDTO>>,
									isAdmin: boolean = false
								) => {
								void requestingUserId, targetUserId, logId, log, isAdmin; // suppress unused variable warning
								return Promise.resolve(); // return nothing
							}
						);
					});

					afterEach(() => {
						serviceSpy?.mockRestore();
						jest.clearAllMocks();
					});

					it('updates an existing conditioning log', async () => {
						// arrange
						// act
						const result = await controller.updateLog(
							userMockRequest,
							userIdDTO,
							updatedLogIdDTO,
							updatedLogDto
						);

						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						
						const params = serviceSpy.mock.calls[0];
						const [requestingId, targetId, logId, logData, isAdmin] = params;
						
						expect(requestingId).toEqual(userContxt.userId);
						expect(targetId).toEqual(userId);
						expect(logId).toEqual(updatedLogId);
						// Check only a sample of log properties
						expect(logData.activity).toEqual(updatedLog.activity);
						expect(logData.activityOrder).toEqual(updatedLog.activityOrder);
						expect(logData.constructor.name).toEqual(updatedLog.constructor.name);
						expect(logData.isOverview).toEqual(updatedLog.isOverview);
						expect(isAdmin).toEqual(userContxt.roles.includes('admin'));
						
						expect(result).toBeUndefined(); // void response returned as undefined				
					});

					it('throws if user id is missing', async () => {
						// arrange
						userMockRequest.user = undefined; // simulate missing user id in request

						// act/assert
						expect(async () => await controller.updateLog(userMockRequest, undefined as any, updatedLogIdDTO, updatedLogDto)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant user id to the data service, so this test is not needed

					it('throws if log data is missing', async () => {
						// arrange
						
						// act/assert
						expect(async () => await controller.updateLog(userMockRequest, userIdDTO, updatedLogIdDTO, undefined as any)).rejects.toThrow();
					});

					it('throws if log data is invalid', async () => {
						// arrange
						// act/assert
						expect(async () => await controller.updateLog(userMockRequest, userIdDTO, updatedLogIdDTO, { activity: 'invalid' } as any)).rejects.toThrow();
					});

					it('throws if data service rejects', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'updateLog').mockImplementation(() => { return Promise.reject(new Error('Log not updated')); });

						// act/assert
						expect(async () => await controller.updateLog(userMockRequest, userIdDTO, updatedLogIdDTO, updatedLogDto)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});

					it('throws if data service throws', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'updateLog').mockImplementation(() => { throw new Error('Test Error'); });

						// act/assert
						expect(async () => await controller.updateLog(userMockRequest, userIdDTO, updatedLogIdDTO, updatedLogDto)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});
				});

				describe('deleteLog', () => {
					let serviceSpy: any;
					let deletedLogId: EntityId;
					let deletedLogIdDTO: LogIdDTO;
					beforeEach(() => {
						deletedLogId = uuid();
						deletedLogIdDTO = new LogIdDTO(deletedLogId);
						serviceSpy = jest.spyOn(service, 'deleteLog')
							.mockImplementation((
								requestingUserId: EntityId,
								targetUserId: EntityId,
								logId: EntityId,
								softDelete?: boolean,
								isAdmin?: boolean
							) => {
								void requestingUserId, targetUserId, logId, softDelete, isAdmin; // suppress unused variable warning
								return Promise.resolve(); // return nothing
							}
						);
					});

					afterEach(() => {
						serviceSpy && serviceSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('deletes an existing conditioning log', async () => {
						// arrange						
						// act
						const result = await controller.deleteLog(
							userMockRequest,
							userIdDTO,
							deletedLogIdDTO
						);

						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						
						const params = serviceSpy.mock.calls[0];
						const [requestingId, targetId, logId, softDelete, isAdmin] = params;
						
						expect(requestingId).toEqual(userContxt.userId);
						expect(targetId).toEqual(userId);
						expect(logId).toEqual(deletedLogId);
						expect(softDelete).toBeUndefined();
						expect(isAdmin).toEqual(userContxt.roles.includes('admin'));

						expect(result).toBeUndefined(); // void response returned as undefined
					});

					it('throws if user id is missing', async () => {
						// arrange
						userMockRequest.user = undefined; // simulate missing user id in request

						// act/assert
						expect(async () => await controller.deleteLog(userMockRequest, undefined as any, deletedLogIdDTO)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant user id to the data service, so this test is not needed

					it('throws if log id is missing', async () => {
						// arrange
						// act/assert
						expect(async () => await controller.deleteLog(userMockRequest, userIdDTO, undefined as any)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant log id to the data service, so this test is not needed

					it('throws if data service rejects', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'deleteLog').mockImplementation(() => { return Promise.reject(new Error('Log not deleted')); });
						
						// act/assert
						expect(async () => await controller.deleteLog(userMockRequest, userIdDTO, deletedLogIdDTO)).rejects.toThrow();
					});

					it('throws if data service throws', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'deleteLog').mockImplementation(() => { throw new Error('Test Error'); });
						
						// act/assert
						expect(async () => await controller.deleteLog(userMockRequest, userIdDTO, deletedLogIdDTO)).rejects.toThrow();
					});
				});

				describe('undeleteLog', () => {
					let serviceSpy: any;
					let undeletedLogId: EntityId;
					let undeletedLogIdDTO: LogIdDTO;
					beforeEach(() => {
						undeletedLogId = uuid();
						undeletedLogIdDTO = new LogIdDTO(undeletedLogId);
						serviceSpy = jest.spyOn(service, 'undeleteLog')
							.mockImplementation((
								requestingUserId: EntityId,
								targetUserId: EntityId,
								logId: EntityId,
								isAdmin?: boolean
							) => {
								void requestingUserId, targetUserId, logId, isAdmin; // suppress unused variable warning
								return Promise.resolve(); // return nothing
							}
						);
					});

					afterEach(() => {
						serviceSpy?.mockRestore();
						jest.clearAllMocks();
					});

					it('undeletes a soft deleted conditioning log', async () => {
						// arrange
						
						// act
						const result = await controller.undeleteLog(
							userMockRequest,
							userIdDTO,
							undeletedLogIdDTO
						);
							
						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);

						const params = serviceSpy.mock.calls[0];
						const [requestingId, targetId, logId, isAdmin] = params;

						expect(requestingId).toEqual(userContxt.userId);
						expect(targetId).toEqual(userContxt.userId);
						expect(logId).toEqual(undeletedLogId);
						expect(isAdmin).toEqual(userContxt.roles.includes('admin'));
						
						expect(result).toBeUndefined(); // void response returned as undefined
					});

					it('throws if user id is missing', async () => {
						// arrange
						userMockRequest.user = undefined; // simulate missing user id in request
						
						// act/assert
						expect(async () => await controller.undeleteLog(userMockRequest, undefined as any, undeletedLogIdDTO)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant user id to the data service, so this test is not needed

					it('throws if log id is missing', async () => {
						// arrange
						// act/assert
						expect(async () => await controller.undeleteLog(userMockRequest, userIdDTO, undefined as any)).rejects.toThrow();
					});

					// NOTE: Controller defers validation of extant log id to the data service, so this test is not needed

					it('throws if data service rejects', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'undeleteLog').mockImplementation(() => { return Promise.reject(new Error('Log not undeleted')); });
						
						// act/assert
						await expect(controller.undeleteLog(userMockRequest, userIdDTO, undeletedLogIdDTO)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});

					it('throws if data service throws', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'undeleteLog').mockImplementation(() => { throw new Error('Test Error'); });
						
						// act/assert
						await expect(controller.undeleteLog(userMockRequest, userIdDTO, undeletedLogIdDTO)).rejects.toThrow();

						// Clean up
						serviceSpy?.mockRestore();
					});
				});
			});
		
			describe('multiple logs', () => {
				describe('fetchLogs', () => {
					let adminContext: UserContext;
					let serviceSpy: any;
					let queryDTO: QueryDTO;
					let queryDTOProps: QueryDTOProps;
					let userIdDTO: UserIdDTO;
					beforeEach(() => {
						adminContext = new UserContext(adminProps);

						queryDTOProps = {
							start: '2021-01-01',
							end: '2021-12-31',
							activity: ActivityType.MTB,
							//userId: userContext.userId as unknown as string,
							sortBy: 'duration',
							order: 'ASC',
							page: 1,
							pageSize: 10,
						};
						queryDTO = new QueryDTO(queryDTOProps);
						
						serviceSpy = jest.spyOn(service, 'fetchLogs').mockImplementation(
							(requestingUserId: EntityId, targetUserId?: EntityId | undefined, queryDTO?: QueryDTO, isAdmin?: boolean, includeDeleted?: boolean) => {
								void requestingUserId, targetUserId, queryDTO, isAdmin, includeDeleted; // suppress unused variable warning
								if (isAdmin) { // simulate an admin user requesting logs
									return Promise.resolve([]); // return empty array for admin
								}
								else { // simulate a normal user requesting logs
									if (requestingUserId === targetUserId) { // simulate a normal user requesting their own logs
										return Promise.resolve([]); // return empty array for user
									}
									else { // simulate a normal user requesting another user's logs
										throw new ForbiddenException('User not authorized to access logs'); // throw an error
									}
								}
								/*else { // simulate a user without any roles
									throw new ForbiddenException('User not authorized to access logs'); // throw an error
								}*/
							}
						);
						
						userIdDTO = new UserIdDTO(userContxt.userId);
					});

					afterEach(() => {
						serviceSpy && serviceSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('gives normal users access to a collection of all their conditioning logs', async () => {
						// arrange
						// act
						const result = await controller.fetchLogs(
							userMockRequest,
							userIdDTO,
							//includeDeletedDTO,
							//queryDTO
						);
						
						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						expect(serviceSpy).toHaveBeenCalledWith(userContxt.userId, userIdDTO.value, undefined, false, false);

						expect(result).toBeDefined();
						expect(result).toBeInstanceOf(Array);
						expect(result.length).toBe(0); // since we mocked the service to return an empty array
					});

					it('optionally gives normal users access to their logs matching a query', async () => {
						// arrange						
						// act
						const result = await controller.fetchLogs(
							userMockRequest,
							userIdDTO,
							undefined, // includeDeletedDTO,
							queryDTO
						);
						
						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						expect(serviceSpy).toHaveBeenCalledWith(userContxt.userId, userIdDTO.value, queryDTO, false, false);

						expect(result).toBeDefined();
						expect(result).toBeInstanceOf(Array);
						expect(result.length).toBe(0); // since we mocked the service to return an empty array
					});

					it('gives admin users access to all logs for all users', async () => {
						// arrange
						// act
						const result = await controller.fetchLogs(
							adminMockRequest,
							adminUserIdDTO,
							// includeDeletedDTO,
							// queryDTO
						);

						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						expect(serviceSpy).toHaveBeenCalledWith(adminContext.userId, adminUserIdDTO.value, undefined, true, false);
					});

					it('optionally gives admin users access to logs matching a query', async () => {
						// arrange
						// act
						const result = await controller.fetchLogs(
							adminMockRequest,
							adminUserIdDTO,
							undefined, // includeDeletedDTO,
							queryDTO
						);

						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						expect(serviceSpy).toHaveBeenCalledWith(adminContext.userId, adminUserIdDTO.value, queryDTO, true, false);

						expect(result).toBeDefined();
						expect(result).toBeInstanceOf(Array);
						expect(result.length).toBe(0); // since we mocked the service to return an empty array
					});

					it('does not pass empty query parameters to the data service', async () => {
						// arrange
						// act
						const result = await controller.fetchLogs(
							userMockRequest,
							userIdDTO,
							undefined, // includeDeletedDTO,
							new QueryDTO({})
						);

						// assert
						expect(serviceSpy).toHaveBeenCalledTimes(1);
						expect(serviceSpy).toHaveBeenCalledWith(userContxt.userId, userIdDTO.value, undefined, false, false);

						expect(result).toBeDefined();
						expect(result).toBeInstanceOf(Array);
						expect(result.length).toBe(0); // since we mocked the service to return an empty array
					});
					
					it('throws error if data service rejects', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'fetchLogs').mockImplementation(() => { return Promise.reject(new Error('Logs not found')); });
						
						// act/assert
						await expect(controller.fetchLogs(userMockRequest, userIdDTO, undefined, queryDTO)).rejects.toThrow();

						// cleanup
						serviceSpy?.mockRestore();
					});

					it('throws error if data service throws', async () => {
						// arrange
						serviceSpy.mockRestore();
						serviceSpy = jest.spyOn(service, 'fetchLogs').mockImplementation(() => { throw new Error('Test Error'); });
						
						// act/assert
						await expect(controller.fetchLogs(userMockRequest, userIdDTO, undefined, queryDTO)).rejects.toThrow();

						// cleanup
						serviceSpy?.mockRestore();
					});
				});
			});
		});

		describe('rules', () => {
			it('provides collection of ConditioningLog validation rules', async () => {
				// arrange
				const expectedRules = ['rule 1', 'rule 2', 'rule 3']; // mock rules
				const spy = jest.spyOn(ConditioningLog, 'getSanitizationRules').mockImplementationOnce(() => Promise.resolve([...expectedRules]) as any);
				
				// act
				const result = await controller.fetchValidationRules(new DomainTypeDTO('ConditioningLog'));
				
				// assert
				expect(result).toBeDefined();
				expect(result).toEqual(expectedRules);
				expect(spy).toHaveBeenCalledTimes(1);
				expect(spy).toHaveBeenCalledWith();

				// cleanup
				spy && spy.mockRestore();
				jest.clearAllMocks();
			});

			it('throws error if provided type is unkown', async () => {
				// arrange
				// act
				expect(async () => await controller.fetchValidationRules('no-such-type' as any)).rejects.toThrow();
			});

			it('throws error if type is not provided', async () => {
				// arrange
				// act
				expect(async () => await controller.fetchValidationRules(undefined as any)).rejects.toThrow();
			});
		});

		describe('sessions', () => {
			it('provides a collection of conditioning data', async () => {
				// arrange
				const serviceSpy = jest.spyOn(service, 'conditioningData');

				// act
				void await controller.sessions();
				
				// assert
				expect(serviceSpy).toHaveBeenCalledTimes(1);
				expect(serviceSpy).toHaveBeenCalledWith();

				// cleanup
				serviceSpy?.mockRestore();
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
