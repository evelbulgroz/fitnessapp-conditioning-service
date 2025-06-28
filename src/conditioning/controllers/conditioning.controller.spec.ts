import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ForbiddenException, INestApplication } from '@nestjs/common';

import { jest } from '@jest/globals';
import { of, lastValueFrom, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLogger } from '../../libraries/stream-loggable';

import { AggregationQueryDTO, AggregationQueryDTOProps } from '../dtos/aggregation-query.dto';
import { BooleanDTO } from '../../shared/dtos/responses/boolean.dto';
import { ConditioningController } from './conditioning.controller';
import { BcryptCryptoService } from '../../authentication/services/crypto/bcrypt-crypto.service';
import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { createTestingModule } from '../../test/test-utils';
import { CryptoService } from '../../authentication/services/crypto/domain/crypto-service.model';
import { EntityIdDTO } from '../../shared/dtos/responses/entity-id.dto';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { JwtAuthStrategy } from '../../infrastructure/strategies/jwt-auth.strategy';
import { JwtSecretService } from '../../authentication/services/jwt/jwt-secret.service';
import { JwtService } from '../../authentication/services/jwt/domain/jwt-service.model';
import { JsonWebtokenService } from '../../authentication/services/jwt/json-webtoken.service';
import { QueryDTO, QueryDTOProps } from '../../shared/dtos/responses/query.dto';
import { UserContext, UserContextProps } from '../../shared/domain/user-context.model';
import { UserJwtPayload } from '../../authentication/services/jwt/domain/user-jwt-payload.model';
import { UserRepository } from '../../user/repositories/user.repo';
import { ValidationPipe } from '../../infrastructure/pipes/validation.pipe';
import exp from 'constants';
import DomainTypeDTO from '../../shared/dtos/responses/domain-type.dto';

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
		http = module.get<HttpService>(HttpService);
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
	let adminUserIdDTO: EntityIdDTO;
	let userAccessToken: string;
	let headers: any;
	let userContxt: UserContext;
	let userId: EntityId;
	let userIdDTO: EntityIdDTO;
	let userMockRequest: any; // mock request object for testing purposes
	let userPayload: UserJwtPayload;
	let userProps: UserContextProps;
	let userRepoSpy: any;
	beforeEach(async () => {
		adminUserId = uuid();

		adminUserIdDTO = new EntityIdDTO(adminUserId);

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

		userIdDTO = new EntityIdDTO(userId);

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

		headers = { Authorization: `Bearer ${userAccessToken}` };

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
				const includeDeletedDTO = new BooleanDTO(false);
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
				const args = serviceSpy.mock.calls[0];
				expect(args[0]).toEqual(userContxt);
				expect(args[1]).toEqual(userIdDTO);
				expect(args[2]).toEqual(expectedQueryDTO);
				expect(args[3]).toEqual(includeDeletedDTO);

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called without a user id', async () => {
				// arrange
				const includeDeletedDTO = new BooleanDTO(false);
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
				const args = serviceSpy.mock.calls[0];
				expect(args[0]).toEqual(userContxt);// user context
				expect(args[1]).toBeUndefined(); // user id
				expect(args[2]).toEqual(expectedQueryDTO); // query
				expect(args[3]).toEqual(includeDeletedDTO); // includeDeleted

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called with without includeDeleted', async () => {
				// arrange
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts');				
				
				// act
				void await controller.activities(
					userMockRequest,
					new EntityIdDTO(userContxt.userId),
					undefined, // no includeDeleted
					expectedQueryDTO,
				);
				
				// assert
				expect(serviceSpy).toHaveBeenCalledTimes(1);
				const args = serviceSpy.mock.calls[0];
				expect(args[0]).toEqual(userContxt);// user context
				expect(args[1]).toEqual(userIdDTO); // user id
				expect(args[2]).toBe(expectedQueryDTO); // query
				expect(args[3]).toBeUndefined(); // includeDeleted

				// clean up
				serviceSpy?.mockRestore();
			});

			it('can be called with without a query', async () => {
				// arrange
				const includeDeletedDTO = new BooleanDTO(false);				
				const spy = jest.spyOn(service, 'fetchActivityCounts');				
				
				// act/assert
				void await controller.activities(
					userMockRequest,
					new EntityIdDTO(userContxt.userId),
					includeDeletedDTO,
					undefined, // no query
				);
				
				// assert
				expect(spy).toHaveBeenCalledTimes(1);
				const args = spy.mock.calls[0];
				expect(args[0]).toEqual(userContxt);// user context
				expect(args[1]).toEqual(new EntityIdDTO(userContxt.userId)); // user id
				expect(args[2]).toBeUndefined(); // query
				expect(args[3]).toEqual(new BooleanDTO(false)); // includeDeleted

				// clean up
				spy?.mockRestore();
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

		xdescribe('aggregate', () => {
			let aggregationSpy: any;
			let adminLogs: any[];
			let userLogs: any[];
			let url: string;
			let aggregationQueryDTOProps: AggregationQueryDTOProps;
			let queryDTOProps: QueryDTOProps;
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
					.mockImplementation((ctx: UserContext) => {
						if (ctx.roles?.includes('admin')) { // simulate an admin user requesting logs
							return Promise.resolve(adminLogs as any)
						}
						else if(ctx.roles?.includes('user')) { // simulate a normal user requesting logs
							return Promise.resolve(userLogs as any)
						}
						else { // simulate a user without any roles
							throw new ForbiddenException('User not authorized to access logs'); // throw an error
						}
					});

				aggregationQueryDTOProps = { // body of request
					"aggregatedType": "ConditioningLog",
					"aggregatedProperty": "duration",
					"aggregationType": "SUM",
					"sampleRate": "DAY",
					"aggregatedValueUnit": "ms"
				};

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

				url = `${baseUrl}/aggregate`;
			});

			afterEach(() => {
				aggregationSpy && aggregationSpy.mockRestore();
				jest.clearAllMocks();
			});

			it('gives non-admin users access to aggregate a collection of all their own conditioning logs', async () => {
				// arrange
				
				// act
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });				
				const response = await lastValueFrom(response$);
				
				// assert
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				const args = aggregationSpy.mock.calls[0];
				expect(args[0]).toEqual(userContxt);
				expect(args[1]).toEqual(new AggregationQueryDTO(aggregationQueryDTOProps));
				expect(args[2]).toBeUndefined();
				expect(response).toBeDefined();
				expect(response.data).toEqual(userLogs);
			});

			it('optionally gives non-admin users access to aggregate their logs matching a query', async () => {
				// arrange
				
				// act
				const response$ = http.post(url, aggregationQueryDTOProps, { params: queryDTOProps, headers });
				const response = await lastValueFrom(response$);
				
				// assert
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				const args = aggregationSpy.mock.calls[0];
				expect(args[0]).toEqual(userContxt);
				expect(args[1]).toEqual(new AggregationQueryDTO(aggregationQueryDTOProps));
				expect(args[2]).toEqual(new QueryDTO(queryDTOProps));

				expect(response).toBeDefined();
				expect(response.data).toEqual(userLogs);

				// cleanup
				aggregationSpy && aggregationSpy.mockRestore();
			});

			it('gives admin users access to aggregate a collection of all logs for all users', async () => {
				// arrange
				const adminContext = new UserContext(adminProps);
				const headers = { Authorization: `Bearer ${adminAccessToken}` };

				// act
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });

				// assert
				const response = await lastValueFrom(response$);
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				const args = aggregationSpy.mock.calls[0];
				expect(args[0]).toEqual(adminContext);
				expect(args[1]).toEqual(new AggregationQueryDTO(aggregationQueryDTOProps));
				expect(args[2]).toBeUndefined();
				expect(response).toBeDefined();
				expect(response.data).toEqual(adminLogs);
			});

			it('optionally gives admin users access to aggregate logs matching a query', async () => {
				// arrange
				const adminContext = new UserContext(adminProps);
				const headers = { Authorization: `Bearer ${adminAccessToken}` };

				// act
				const response$ = http.post(url, aggregationQueryDTOProps, { params: queryDTOProps, headers });

				// assert
				const response = await lastValueFrom(response$);
				expect(aggregationSpy).toHaveBeenCalledTimes(1);
				const args = aggregationSpy.mock.calls[0];
				expect(args[0]).toEqual(adminContext);
				expect(args[1]).toEqual(new AggregationQueryDTO(aggregationQueryDTOProps));
				expect(args[2]).toEqual(new QueryDTO(queryDTOProps));
				expect(response).toBeDefined();
				expect(response.data).toEqual(adminLogs);
			});

			it('fails if access token is missing', async () => {
				// arrange
				const response$ = http.post(url, aggregationQueryDTOProps);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if access token is invalid', async () => {
				// arrange
				const invalidHeaders = { Authorization: `Bearer invalid` };

				// act/assert
				const response$ = http.post(url, aggregationQueryDTOProps, { headers: invalidHeaders });
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if user information in token payload is invalid', async () => {
				// arrange
				userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				const userAccessToken = await jwt.sign(adminPayload);
				const response$ = http.post(url, aggregationQueryDTOProps, { headers: { Authorization: `Bearer ${userAccessToken}` } });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if aggregation query is present but has invalid data', async () => {
				// arrange
				aggregationQueryDTOProps.aggregatedType = 'invalid'; // invalid type
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if aggregation query is present but has non-whitelisted properties', async () => {
				// arrange
				(aggregationQueryDTOProps as any).invalid = 'invalid'; // invalid property
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if query is present but has invalid data', async () => {
				// arrange
				aggregationQueryDTOProps.aggregatedType = 'invalid'; // invalid type
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if query is present but has non-whitelisted properties', async () => {
				// arrange
				(aggregationQueryDTOProps as any).invalid = 'invalid'; // invalid property
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if roles claim is missing', async () => {
				// arrange
				delete userPayload.roles;
				const accessToken = await jwt.sign(userPayload);
				const headers = { Authorization: `Bearer ${accessToken}` };

				// act/assert
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if roles claim is invalid', async () => {
				// arrange
				userPayload.roles = ['invalid'];
				const accessToken = await jwt.sign(userPayload);
				const headers = { Authorization: `Bearer ${accessToken}` };

				// act/assert
				const response$ = http.post(url, aggregationQueryDTOProps, { headers });
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});
		});

		xdescribe('logs', () => {
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
							.mockImplementation((ctx: any, userIdDTO: EntityIdDTO, log: ConditioningLog<any,ConditioningLogDTO>) => {
								void ctx, userIdDTO, log; // suppress unused variable warning
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
						expect(params[0]).toEqual(userContxt);
						expect(params[1]).toEqual(userIdDTO);
						expect(params[2]).toBeInstanceOf(ConditioningLog);
						expect(params[2].toDTO()).toEqual(sourceLogDto);
						
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
					let logIdDTO: EntityIdDTO;
					let serviceSpy: any;
					beforeEach(() => {
						log = { activity: 'SWIM' } as unknown as ConditioningLog<any, ConditioningLogDTO>;
						logId = uuid();
						logIdDTO = new EntityIdDTO(logId);
						serviceSpy = jest.spyOn(service, 'fetchLog')
							.mockImplementation((ctx: any, entityId: EntityIdDTO) => {
								void entityId;
								if (ctx.roles?.includes('admin')) { // simulate an admin user requesting a log
									return Promise.resolve(log); // return the log (admins can access all logs)
								}
								else if(ctx.roles?.includes('user')) { // simulate a normal user requesting a log
									if (userContxt.userId === ctx.userId) { // simulate a normal user requesting their own log
										return Promise.resolve(log); // return the log
									}
									else { // simulate a normal user requesting another user's log
										throw new ForbiddenException('User not authorized to access log'); // throw an error
									}
								}
								else { // simulate a user without any roles
									throw new ForbiddenException('User not authorized to access log'); // throw an error
								}					
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
						const params = serviceSpy.mock.calls[0];
						expect(params[0]).toEqual(userContxt);
						expect(params[1]).toEqual(userIdDTO);
						expect(params[2]).toEqual(logIdDTO);
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
					let updatedLogIdDTO: EntityIdDTO;
					beforeEach(() => {
						updatedLogId = uuid();
						updatedLogIdDTO = new EntityIdDTO(updatedLogId);
						updatedLog = ConditioningLog.create({
							activity: ActivityType.SWIM,
							isOverview: true,
							duration: { value: 3600, unit: 's' },
							className: 'ConditioningLog'
						}).value as ConditioningLog<any, ConditioningLogDTO>;
						updatedLogDto = updatedLog.toDTO();

						serviceSpy = jest.spyOn(service, 'updateLog')
							.mockImplementation(
								(
									ctx: UserContext,
									userIdDTO: EntityIdDTO,
									logIdDTO: EntityIdDTO,
									partialLog: Partial<ConditioningLog<any,ConditioningLogDTO>>
								) => {
									void ctx, userIdDTO, logIdDTO, partialLog; // suppress unused variable warning
									return Promise.resolve(); // return the log
								}
							);
					});

					afterEach(() => {
						serviceSpy && serviceSpy.mockRestore();
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
						expect(params[0]).toEqual(userContxt);
						expect(params[1]).toEqual(new EntityIdDTO(userContxt.userId));
						expect(params[2]).toEqual(new EntityIdDTO(updatedLogId));
						expect(params[3].toDTO()).toEqual(updatedLogDto);
						
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
					let deletedLogIdDTO: EntityIdDTO;
					beforeEach(() => {
						deletedLogId = uuid();
						deletedLogIdDTO = new EntityIdDTO(deletedLogId);
						serviceSpy = jest.spyOn(service, 'deleteLog')
							.mockImplementation((ctx: UserContext, entityId: EntityIdDTO) => {
								void ctx, entityId; // suppress unused variable warning
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
						expect(params[0]).toEqual(userContxt);
						expect(params[1]).toEqual(userIdDTO);
						expect(params[2]).toEqual(deletedLogIdDTO);
						
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
					let undeletedLogIdDTO: EntityIdDTO;
					beforeEach(() => {
						undeletedLogId = uuid();
						undeletedLogIdDTO = new EntityIdDTO(undeletedLogId);
						serviceSpy = jest.spyOn(service, 'undeleteLog')
							.mockImplementation((ctx: UserContext, entityId: EntityIdDTO) => {
								void ctx, entityId; // suppress unused variable warning
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
						expect(params[0]).toEqual(userContxt);
						expect(params[1]).toEqual(new EntityIdDTO(userContxt.userId));
						expect(params[2]).toEqual(new EntityIdDTO(undeletedLogId));
						
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
					let userIdDTO: EntityIdDTO;
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
							(ctx: UserContext, userIdDTO?: EntityIdDTO, queryDTO?: QueryDTO, includeDeleted?: boolean) => {
								void ctx, userIdDTO, queryDTO, includeDeleted; // suppress unused variable warning
								if (ctx.roles?.includes('admin')) { // simulate an admin user requesting logs
									return Promise.resolve([]); // return empty array for admin
								}
								else if(ctx.roles?.includes('user')) { // simulate a normal user requesting logs
									if (userContxt.userId === ctx.userId) { // simulate a normal user requesting their own logs
										return Promise.resolve([]); // return empty array for user
									}
									else { // simulate a normal user requesting another user's logs
										throw new ForbiddenException('User not authorized to access logs'); // throw an error
									}
								}
								else { // simulate a user without any roles
									throw new ForbiddenException('User not authorized to access logs'); // throw an error
								}
							}
						);
						
						userIdDTO = new EntityIdDTO(userContxt.userId);
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
						expect(serviceSpy).toHaveBeenCalledWith(userContxt, userIdDTO, undefined, undefined); // skip optional parameters

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
						expect(serviceSpy).toHaveBeenCalledWith(userContxt, userIdDTO, queryDTO, undefined);

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
						expect(serviceSpy).toHaveBeenCalledWith(adminContext, adminUserIdDTO, undefined, undefined); // skip optional parameters
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
						expect(serviceSpy).toHaveBeenCalledWith(adminContext, adminUserIdDTO, queryDTO, undefined);

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
						expect(serviceSpy).toHaveBeenCalledWith(userContxt, userIdDTO, undefined, undefined);

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
			let url: string;
			let urlPath: string;
			beforeEach(() => {
				url = `${baseUrl}/rules/`;
				urlPath = url + 'ConditioningLog';
			});
			
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
		});		

		xdescribe('sessions', () => {
			it('provides a collection of conditioning data', async () => {
				// arrange
				const spy = jest.spyOn(service, 'conditioningData');

				// act
				void await controller.sessions();
				
				// assert
				expect(spy).toHaveBeenCalledTimes(1);
				expect(spy).toHaveBeenCalledWith();

				// cleanup
				spy && spy.mockRestore();
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
