import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ForbiddenException, INestApplication } from '@nestjs/common';

import { jest } from '@jest/globals';
import { of, lastValueFrom, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { Logger } from '@evelbulgroz/logger';
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { StreamLogger } from '../../libraries/stream-loggable';

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

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// NOTE:
  // Testing over http to enable decorators and guards without having to do a ton of additional setup/mocking.
  // This also ensures request/response objects are correctly formatted and that the controller is correctly configured.
  // This is a bit of a hack, but it works for now. Clean up later when setting up e2e tests.

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
				{ // Logger (suppress console output)
					provide: Logger,
					useValue: {
						log: jest.fn(),
						error: jest.fn(),
						warn: jest.fn(),
						debug: jest.fn(),
						verbose: jest.fn(),
					},
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
	let adminPayload: UserJwtPayload;
	let adminProps: UserContextProps;
	let userAccessToken: string;
	let headers: any;
	let userContext: UserContext;
	let userPayload: UserJwtPayload;
	let userRepoSpy: any;
	beforeEach(async () => {
		adminProps = {
			userId: uuid(),
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

		//console.debug('adminPayload:', adminPayload);

		adminAccessToken = await jwt.sign(adminPayload);

		userContext = new UserContext({ 
			userId: uuid(),
			userName: 'testuser',
			userType: 'user',
			roles: ['user'],
		});

		userPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: userContext.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: userContext.userName,
			subType: userContext.userType,
			roles: ['user'],
		};

		userAccessToken = await jwt.sign(userPayload);

		headers = { Authorization: `Bearer ${userAccessToken}` };

		userRepoSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => Promise.resolve(Result.ok(of({entityId: userContext.userId} as any))));
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
			let url: string;
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
				url = `${baseUrl}/activities?userId=${userContext.userId}&includeDeleted=false&${queryString}`;
			});

			afterEach(() => {
				jest.clearAllMocks();
			});
			
			it('provides summary of conditioning activities performed by type', async () => {
				// arrange
				const spy = jest.spyOn(service, 'fetchActivityCounts');
				
				// act
				void await lastValueFrom(http.get(url, { headers }));
				
				// assert
				expect(spy).toHaveBeenCalledTimes(1);
				const args = spy.mock.calls[0];
				expect(args[0]).toEqual(userContext);// user context
				expect(args[1]).toEqual(new EntityIdDTO(userContext.userId)); // user id
				expect(args[2]).toEqual(expectedQueryDTO); // query
				expect(args[3]).toEqual(new BooleanDTO(false)); // includeDeleted

				// clean up
				spy?.mockRestore();
			});

			// Note: these tests can be enhanced to check the data forwared to the service, as well as the response

			it('can be called without a user id', async () => {
				// arrange
				const spy = jest.spyOn(service, 'fetchActivityCounts');				
				url = `${baseUrl}/activities?includeDeleted=false`; // no user id

				// act/assert
				await expect(lastValueFrom(http.get(url, { headers }))).resolves.not.toThrow();
				expect(spy).toHaveBeenCalledTimes(1);
				const args = spy.mock.calls[0];
				expect(args[0]).toEqual(userContext);// user context
				expect(args[1]).toBeUndefined(); // user id
				expect(args[2]).toBeUndefined(); // query
				expect(args[3]).toEqual(new BooleanDTO(false)); // includeDeleted

				// clean up
				spy?.mockRestore();
			});

			it('can be called with without includeDeleted', async () => {
				// arrange
				const spy = jest.spyOn(service, 'fetchActivityCounts');				
				url = `${baseUrl}/activities?userId=${userContext.userId}`; // no includeDeleted parameter

				// act/assert
				await expect(lastValueFrom(http.get(url, { headers }))).resolves.not.toThrow();
				expect(spy).toHaveBeenCalledTimes(1);
				const args = spy.mock.calls[0];
				expect(args[0]).toEqual(userContext);// user context
				expect(args[1]).toEqual(new EntityIdDTO(userContext.userId)); // user id
				expect(args[2]).toBeUndefined(); // query
				expect(args[3]).toBeUndefined(); // includeDeleted

				// clean up
				spy?.mockRestore();
			});

			it('can be called with without a query', async () => {
				// arrange
				const spy = jest.spyOn(service, 'fetchActivityCounts');				
				url = `${baseUrl}/activities?userId=${userContext.userId}&includeDeleted=false`; // no query parameters

				// act/assert
				await expect(lastValueFrom(http.get(url, { headers }))).resolves.not.toThrow();
				expect(spy).toHaveBeenCalledTimes(1);
				const args = spy.mock.calls[0];
				expect(args[0]).toEqual(userContext);// user context
				expect(args[1]).toEqual(new EntityIdDTO(userContext.userId)); // user id
				expect(args[2]).toBeUndefined(); // query
				expect(args[3]).toEqual(new BooleanDTO(false)); // includeDeleted

				// clean up
				spy?.mockRestore();
			});

			it('can be called without any query parameters', async () => {
				// arrange
				url = `${baseUrl}/activities`; // no query parameters

				// act/assert
				await expect(lastValueFrom(http.get(url, { headers }))).resolves.not.toThrow();
			});

			it('throws if access token is missing', async () => {
				// arrange
				const response$ = http.get(url);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if access token is invalid', async () => {
				// arrange
				const invalidHeaders = { Authorization: `Bearer invalid` };
				const response$ = http.get(url, { headers: invalidHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if user information in token payload is invalid', async () => {
				// arrange
				userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				const userAccessToken = await jwt.sign(adminPayload);
				const response$ = http.get(url, { headers: { Authorization: `Bearer ${userAccessToken}` } });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if data service throws', async () => {
				// arrange
				const serviceSpy = jest.spyOn(service, 'fetchActivityCounts').mockImplementation(() => { throw new Error('Test Error'); });
				const response$ = http.get(url, { headers });

				// act/assert
				await expect(lastValueFrom(response$)).rejects.toThrow();

				// clean up
				serviceSpy?.mockRestore();
			});
		});

		describe('aggregate', () => {
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
					userId: userContext.userId as unknown as string,
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
				expect(args[0]).toEqual(userContext);
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
				expect(args[0]).toEqual(userContext);
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

		describe('logs', () => {
			describe('single log', () => {
				describe('createLog', () => {
					let sourceLogDto: ConditioningLogDTO;
					let sourceLog : ConditioningLog<any, ConditioningLogDTO>;
					let logSpy: any;
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

						logSpy = jest.spyOn(service, 'createLog')
							.mockImplementation((ctx: any, userIdDTO: EntityIdDTO, log: ConditioningLog<any,ConditioningLogDTO>) => {
								void ctx, userIdDTO, log; // suppress unused variable warning
								return Promise.resolve(newLogId); // return the log
							});

						urlPath = `${baseUrl}/log/`;
						url = urlPath + userContext.userId;
					});

					afterEach(() => {
						logSpy && logSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('creates a new conditioning log for a user and returns its unique id', async () => {
						// arrange
						headers = { Authorization: `Bearer ${userAccessToken}` };

						// act
						const response = await lastValueFrom(http.post(url, sourceLogDto, { headers }));
						
						// assert
						expect(logSpy).toHaveBeenCalledTimes(1);
						const params = logSpy.mock.calls[0];
						expect(params[0]).toEqual(userContext);
						expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
						expect(params[2]).toBeInstanceOf(ConditioningLog);
						expect(params[2].toDTO()).toEqual(sourceLogDto);
						
						expect(response?.data).toBeDefined();
						expect(response?.data).toEqual(newLogId);
					});

					it('throws if access token is missing', async () => {
						// arrange
						const response$ = http.post(url, sourceLogDto);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };
						const response$ = http.post(url, sourceLogDto, { headers: invalidHeaders });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user information in token payload is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
						const userAccessToken = await jwt.sign(adminPayload);
						const response$ = http.post(url, sourceLogDto, { headers: { Authorization: `Bearer ${userAccessToken}` } });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user id is missing', async () => {
						// arrange
						const response$ = http.post(urlPath, sourceLogDto, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user id is invalid', async () => {
						// arrange
						const response$ = http.post(urlPath + 'invalid', sourceLogDto, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log data is missing', async () => {
						// arrange
						const response$ = http.post(urlPath, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log data is invalid', async () => {
						// arrange
						const response$ = http.post(urlPath, 'invalid', { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if data service throws', async () => {
						// arrange
						logSpy.mockRestore();
						logSpy = jest.spyOn(service, 'createLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.post(urlPath, sourceLogDto, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('fetchLog', () => {
					let log: ConditioningLog<any, ConditioningLogDTO>;
					let logId: EntityId;
					let logSpy: any;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						log = { activity: 'SWIM' } as unknown as ConditioningLog<any, ConditioningLogDTO>;
						logId = uuid();
						logSpy = jest.spyOn(service, 'fetchLog')
							.mockImplementation((ctx: any, entityId: EntityIdDTO) => {
								void entityId;
								if (ctx.roles?.includes('admin')) { // simulate an admin user requesting a log
									return Promise.resolve(log); // return the log (admins can access all logs)
								}
								else if(ctx.roles?.includes('user')) { // simulate a normal user requesting a log
									if (userContext.userId === ctx.userId) { // simulate a normal user requesting their own log
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

						urlPath = `${baseUrl}/log`;
						url = `${urlPath}/${userContext.userId}/${logId}`;
					});

					afterEach(() => {
						logSpy && logSpy.mockRestore();
						jest.clearAllMocks();
					});
					
					it('provides a detailed conditioning log', async () => {
						// arrange
						headers = { Authorization: `Bearer ${userAccessToken}` };

						// act
						const response = await lastValueFrom(http.get(url, { headers }));

						// assert
						expect(logSpy).toHaveBeenCalledTimes(1);
						const params = logSpy.mock.calls[0];
						expect(params[0]).toEqual(userContext);
						expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
						expect(params[2]).toEqual(new EntityIdDTO(logId));
						expect(response?.data).toBeDefined();
						expect(response?.data).toEqual(log);
					});

					it('throws if access token is missing', async () => {
						// arrange
						const response$ = http.get(url);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };
						const response$ = http.get(url, { headers: invalidHeaders });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user information in token payload is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
						const userAccessToken = await jwt.sign(adminPayload);
						const response$ = http.get(url, { headers: { Authorization: `Bearer ${userAccessToken}` } });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is missing', async () => {
						// arrange
						const response$ = http.get(urlPath, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is invalid', async () => {
						// arrange
						const response$ = http.get(urlPath + 'invalid', { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});			

					it('throws if data service throws', async () => {
						// arrange
						logSpy.mockRestore();
						logSpy = jest.spyOn(service, 'fetchLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.get(urlPath, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('updateLog', () => {
					let logSpy: any;
					let updatedLogDto: ConditioningLogDTO;
					let updatedLog: ConditioningLog<any, ConditioningLogDTO>;
					let updatedLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						updatedLogId = uuid();
						updatedLog = ConditioningLog.create({
							activity: ActivityType.SWIM,
							isOverview: true,
							duration: { value: 3600, unit: 's' },
							className: 'ConditioningLog'
						}).value as ConditioningLog<any, ConditioningLogDTO>;
						updatedLogDto = updatedLog.toDTO();

						logSpy = jest.spyOn(service, 'updateLog')
							.mockImplementation((ctx: UserContext, userIdDTO: EntityIdDTO, logIdDTO: EntityIdDTO, partialLog: Partial<ConditioningLog<any,ConditioningLogDTO>>) => {
								void ctx, userIdDTO, logIdDTO, partialLog; // suppress unused variable warning
								return Promise.resolve(); // return the log
							}
						);

						urlPath = `${baseUrl}/log/`;
						url = `${urlPath}${userContext.userId}/${updatedLogId}`;
					});

					afterEach(() => {
						logSpy && logSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('updates an existing conditioning log', async () => {
						// arrange
						headers = { Authorization: `Bearer ${userAccessToken}` };

						// act
						const response = await lastValueFrom(http.patch(url, updatedLogDto, { headers }));

						// assert
						expect(logSpy).toHaveBeenCalledTimes(1);
						const params = logSpy.mock.calls[0];
						expect(params[0]).toEqual(userContext);
						expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
						expect(params[2]).toEqual(new EntityIdDTO(updatedLogId));
						//expect(params[3]).toEqual(updatedLogDto);
						expect(params[3].toDTO()).toEqual(updatedLogDto);
						
						expect(response?.data).toBeDefined();
						expect(response?.data).toBe(""); // void response returned as empty string						
					});

					it('throws if access token is missing', async () => {
						// arrange
						const response$ = http.put(url, updatedLogDto);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };

						// act/assert
						const response$ = http.put(url, updatedLogDto, { headers: invalidHeaders });
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user information in token payload is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
						const userAccessToken = await jwt.sign(adminPayload);
						const response$ = http.put(url, updatedLogDto, { headers: { Authorization: `Bearer ${userAccessToken}` } });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is missing', async () => {
						// arrange
						const response$ = http.put(urlPath, updatedLogDto, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is invalid', async () => {
						// arrange
						const response$ = http.put(urlPath + 'invalid', updatedLogDto, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log data is missing', async () => {
						// arrange
						const response$ = http.put(urlPath, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log data is invalid', async () => {
						// arrange
						const response$ = http.put(urlPath, 'invalid', { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if data service throws', async () => {
						// arrange
						logSpy.mockRestore();
						logSpy = jest.spyOn(service, 'updateLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.put(urlPath, updatedLogDto, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('deleteLog', () => {
					let logSpy: any;
					let deletedLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						deletedLogId = uuid();
						//const entityIdDTO = new EntityIdDTO(deletedLogId);
						logSpy = jest.spyOn(service, 'deleteLog')
							.mockImplementation((ctx: UserContext, entityId: EntityIdDTO) => {
								void ctx, entityId; // suppress unused variable warning
								return Promise.resolve(); // return nothing
							}
						);

						urlPath = `${baseUrl}/log/`;
						url = `${urlPath}${userContext.userId}/${deletedLogId}`;
					});

					afterEach(() => {
						logSpy && logSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('deletes an existing conditioning log', async () => {
						// arrange
						headers = { Authorization: `Bearer ${userAccessToken}` };

						// act
						const response = await lastValueFrom(http.delete(url, { headers }));

						// assert
						expect(logSpy).toHaveBeenCalledTimes(1);
						const params = logSpy.mock.calls[0];
						expect(params[0]).toEqual(userContext);
						expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
						expect(params[2]).toEqual(new EntityIdDTO(deletedLogId));
						
						expect(response?.data).toBe(""); // void response returned as empty string
					});

					it('throws if access token is missing', async () => {
						// arrange
						const response$ = http.delete(url);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };

						// act/assert
						const response$ = http.delete(url, { headers: invalidHeaders });
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user information in token payload is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
						const userAccessToken = await jwt.sign(adminPayload);
						const response$ = http.delete(url, { headers: { Authorization: `Bearer ${userAccessToken}` } });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is missing', async () => {
						// arrange
						const response$ = http.delete(urlPath, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is invalid', async () => {
						// arrange
						const response$ = http.delete(urlPath + 'invalid', { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if data service throws', async () => {
						// arrange
						logSpy.mockRestore();
						logSpy = jest.spyOn(service, 'deleteLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.delete(urlPath, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('undeleteLog', () => {
					let logSpy: any;
					let undeletedLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						undeletedLogId = uuid();
						logSpy = jest.spyOn(service, 'undeleteLog')
							.mockImplementation((ctx: UserContext, entityId: EntityIdDTO) => {
								void ctx, entityId; // suppress unused variable warning
								return Promise.resolve(); // return nothing
							}
						);

						urlPath = `${baseUrl}/log/`;
						url = `${urlPath}${userContext.userId}/${undeletedLogId}/undelete`;
					});

					afterEach(() => {
						logSpy?.mockRestore();
						jest.clearAllMocks();
					});

					it('undeletes a soft deleted conditioning log', async () => {
						// arrange
						
						// act
						const response = await lastValueFrom(http.patch(url, {}, { headers }));
							
						// assert
						expect(logSpy).toHaveBeenCalledTimes(1);
						const params = logSpy.mock.calls[0];
						expect(params[0]).toEqual(userContext);
						expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
						expect(params[2]).toEqual(new EntityIdDTO(undeletedLogId));
						
						expect(response?.data).toBe(""); // void response returned as empty string
					});

					it('throws if access token is missing', async () => {
						// arrange
						const response$ = http.patch(url);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };

						// act/assert
						const response$ = http.patch(url, {}, { headers: invalidHeaders });
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user information in token payload is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
						const userAccessToken = await jwt.sign(adminPayload);
						const response$ = http.patch(url, {}, { headers: { Authorization: `Bearer ${userAccessToken}` } });
						
						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if one of either log id or user id is missing', async () => {
						// arrange
						 // note: there is no way to know which id is missing if only one is provided,
						 // so test for both in the same test
						const response$ = http.patch(`urlPath${uuid()}`, {}, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if log id is invalid', async () => {
						// arrange
						const response$ = http.patch(urlPath + 'invalid', {}, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if data service throws', async () => {
						// arrange
						logSpy.mockRestore();
						logSpy = jest.spyOn(service, 'undeleteLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.patch(urlPath, {}, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});
			});
		
			describe('multiple logs', () => {
				describe('fetchLogs', () => {
					let adminContext: UserContext;
					let includeDeletedDTO: BooleanDTO;
					let logsSpy: any;
					let queryDTO: QueryDTO;
					let queryDTOProps: QueryDTOProps;
					let queryString: string;
					let userIdDTO: EntityIdDTO;
					let url: string;
					beforeEach(() => {
						adminContext = new UserContext(adminProps);

						includeDeletedDTO = new BooleanDTO(false);

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
						queryString = `${Object.entries(queryDTOProps).map(([key, value]) => `${key}=${value}`).join('&')}`;

						logsSpy = jest.spyOn(service, 'fetchLogs');
						
						userIdDTO = new EntityIdDTO(userContext.userId);

						url = `${baseUrl}/logs?userId=${userContext.userId}&includeDeleted=false&${queryString}`;
					});

					afterEach(() => {
						logsSpy && logsSpy.mockRestore();
						jest.clearAllMocks();
					});

					it('gives normal users access to a collection of all their conditioning logs', async () => {
						// arrange
						void await lastValueFrom(http.get(url, { headers }));
						
						// assert
						expect(true).toBeTruthy(); // debug
						expect(logsSpy).toHaveBeenCalledTimes(1);
						expect(logsSpy).toHaveBeenCalledWith(userContext, userIdDTO, queryDTO, includeDeletedDTO.value);
					});

					it('optionally gives normal users access to their logs matching a query', async () => {
						// arrange
						
						// act
						void await lastValueFrom(http.get(url, { headers }));
						
						// assert
						expect(logsSpy).toHaveBeenCalledTimes(1);
						expect(logsSpy).toHaveBeenCalledWith(userContext, userIdDTO, queryDTO, includeDeletedDTO.value);
					});

					it('gives admin users access to all logs for all users', async () => {
						// arrange
						const headers = { Authorization: `Bearer ${adminAccessToken}` };
						
						// act
						void await lastValueFrom(http.get(url, { headers }));

						// assert
						expect(logsSpy).toHaveBeenCalledTimes(1);
						expect(logsSpy).toHaveBeenCalledWith(adminContext, userIdDTO, queryDTO, includeDeletedDTO.value);
					});

					it('optionally gives admin users access to logs matching a query', async () => {
						// arrange
						const headers = { Authorization: `Bearer ${adminAccessToken}` };

						// act
						void await lastValueFrom(http.get(url, { headers }));

						// assert
						expect(logsSpy).toHaveBeenCalledTimes(1);
						expect(logsSpy).toHaveBeenCalledWith(adminContext, userIdDTO, queryDTO, includeDeletedDTO.value);
					});
					
					it('throws error if access token is missing', async () => {
						// arrange
						const response$ = http.get(url);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };
						const response$ = http.get(url, { headers: invalidHeaders });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if user id is not provided', async () => {
						// arrange
						const response$ = http.get(`${baseUrl}/logs`, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if user id is invalid', async () => {
						// arrange
						const response$ = http.get(`${baseUrl}/logs/invalid`, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if query is present but has invalid data', async () => {
						// arrange
						queryDTOProps.start = 'invalid'; // invalid date
						const response$ = http.get(url, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if query is present but has non-whitelisted properties', async () => {
						// arrange
						(queryDTOProps as any).invalid = 'invalid'; // invalid property
						const response$ = http.get(url, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if roles claim is missing', async () => {
						// arrange
						delete userPayload.roles;
						const accessToken = await jwt.sign(userPayload);
						const headers = { Authorization: `Bearer ${accessToken}` };
						const response$ = http.get(url, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws error if roles claim is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid'];
						const accessToken = await jwt.sign(userPayload);
						const headers = { Authorization: `Bearer ${accessToken}` };
						const response$ = http.get(url, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
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
				const response = await lastValueFrom(http.get(urlPath, { headers }));
				
				// assert
				expect(response).toBeDefined();
				expect(response.data).toEqual(expectedRules);
				expect(spy).toHaveBeenCalledTimes(1);
				expect(spy).toHaveBeenCalledWith();

				// cleanup
				spy && spy.mockRestore();
				jest.clearAllMocks();
			});
		});		

		describe('sessions', () => {
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
