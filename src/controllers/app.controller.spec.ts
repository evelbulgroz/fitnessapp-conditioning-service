import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ForbiddenException, INestApplication } from '@nestjs/common';

import { jest } from '@jest/globals';
import { of, lastValueFrom } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { ConsoleLogger, Logger, Result } from '@evelbulgroz/ddd-base';
import { ActivityType } from '@evelbulgroz/fitnessapp-base';

import { AggregationQueryDTO } from './dtos/aggregation-query.dto';
import { AggregationQueryDTOProps }	from '../test/models/aggregation-query-dto.props';
import { AppController } from './app.controller';
import { BcryptCryptoService } from '../services/crypto/bcrypt-crypto.service';
import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { createTestingModule } from '../test/test-utils';
import { CryptoService } from '../services/crypto/models/crypto-service.model';
import { EntityIdDTO } from './dtos/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';
import { JwtSecretService } from '../services/jwt/jwt-secret.service';
import { JwtService } from '../services/jwt/models/jwt-service.model';
import { JsonWebtokenService } from '../services/jwt/json-webtoken.service';
import { QueryDTO } from './dtos/query.dto';
import { QueryDTOProps } from '../test/models/query-dto.props';
import { UserContext, UserContextProps } from './domain/user-context.model';
import { UserDTO } from '../dtos/user.dto';
import { UserJwtPayload } from '../services/jwt/models/user-jwt-payload.model';
import { UserRepository } from '../repositories/user-repo.model';
import { ValidationPipe } from './pipes/validation.pipe';

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// NOTE: Testing over Http to enable decorators and guards without having to do a ton of additional setup/mocking.
// NOTE: Only validating that the correct service methods are called with the correct parameters and return the correct results.
// NOTE: This in order to limit scope of tests to the controller: the service methods and e2e are tested elsewhere.

describe('AppController', () => {
	let app: INestApplication;
	let appController: AppController;
	let conditioningDataService: ConditioningDataService;
	let config: ConfigService;
	let crypto: CryptoService;
	let http: HttpService;
	let jwt: JwtService;
	let serverUrl: string;
	let userRepo: UserRepository<any, UserDTO>;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule, // implicitly imports HttpService, adding service to providers array causes error
			],
			controllers: [AppController],
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
					useClass: ConsoleLogger,
				},
				{ // Data service
					provide: ConditioningDataService,
					useValue: {
						fetchaggretagedLogs: jest.fn(),
						conditioningData: jest.fn(),
						fetchLog: jest.fn(),
						fetchLogs: jest.fn(),
						fetchAdminLogs: jest.fn(),
						fetchUserLogs: jest.fn(),
						getByQuery: jest.fn(),
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
		
		app = module.createNestApplication();
		appController = module.get<AppController>(AppController);
		conditioningDataService = module.get<ConditioningDataService>(ConditioningDataService);
		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		http = module.get<HttpService>(HttpService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository<any, UserDTO>>(UserRepository);

		app.useGlobalPipes(new ValidationPipe());
		await app.listen(0); // enter 0 to let the OS choose a free port

		const port = app.getHttpServer().address().port; // random port, e.g. 60703
		serverUrl = `http://localhost:${port}`; // prefix not applied during testing, so omit it
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
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: adminProps.userName,
			subType: adminProps.userType as any,
			roles: ['admin'],
		};

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
		expect(appController).toBeDefined();
	});

	describe('Endpoints', () => {
		describe(`activities`, () => {
			let logsSpy: any;
			let url: string;
			beforeEach(() => {
				logsSpy = jest.spyOn(conditioningDataService, 'fetchLogs').mockImplementationOnce(() => [
					{ activity: 'SWIM' },
					{ activity: 'BIKE' },
					{ activity: 'RUN' },
					{ activity: 'MTB' },
					{ activity: 'MTB' },
				] as unknown as Promise<ConditioningLog<any, ConditioningLogDTO>[]>);			

				url = `${serverUrl}/activities`;
			});

			afterEach(() => {
				logsSpy && logsSpy.mockRestore();
				jest.clearAllMocks();
			});
			
			it('provides summary of conditioning activities performed by type ', async () => {
				// arrange
				const spy = jest.spyOn(conditioningDataService, 'fetchLogs').mockImplementationOnce(() => [
					{ activity: 'SWIM' },
					{ activity: 'BIKE' },
					{ activity: 'RUN' },
					{ activity: 'MTB' },
					{ activity: 'MTB' },
				] as unknown as Promise<ConditioningLog<any, ConditioningLogDTO>[]>);
				
				const expectedResult = { MTB: 2, RUN: 1, SWIM: 1, BIKE: 1, SKI: 0, OTHER: 0 };

				// act
				const response = await lastValueFrom(http.get(url, { headers }));
				
				// assert
				expect(spy).toHaveBeenCalledTimes(1);
				expect(spy).toHaveBeenCalledWith(userContext);
				expect(response).toBeDefined();
				expect(response.data).toEqual(expectedResult);

				// cleanup
				spy && spy.mockRestore();
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
				logsSpy.mockRestore();
				logsSpy = jest.spyOn(conditioningDataService, 'fetchLogs').mockImplementation(() => { throw new Error('Test Error'); });
				const response$ = http.get(url, { headers });

				// act/assert
				await expect(lastValueFrom(response$)).rejects.toThrow();
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
				aggregationSpy = jest.spyOn(conditioningDataService, 'fetchaggretagedLogs')
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

				url = `${serverUrl}/aggregate`;
			});

			afterEach(() => {
				aggregationSpy && aggregationSpy.mockRestore();
				jest.clearAllMocks();
			});

			it('gives normal users access to aggregate a collection of all their conditioning logs', async () => {
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

			it('optionally gives normal users access to aggregate their logs matching a query', async () => {
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

		describe('GET log', () => {
			let log: ConditioningLog<any, ConditioningLogDTO>;
			let logSpy: any;
			let url: string;
			let urlPath: string;
			beforeEach(() => {
				log = { activity: 'SWIM' } as unknown as ConditioningLog<any, ConditioningLogDTO>;
				logSpy = jest.spyOn(conditioningDataService, 'fetchLog')
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

				urlPath = `${serverUrl}/logs/`;
				url = urlPath + uuid();
			});

			afterEach(() => {
				logSpy && logSpy.mockRestore();
				jest.clearAllMocks();
			});
			
			it('provides a detailed conditioning log', async () => {
				// arrange
				const userLogId = uuid();
				headers = { Authorization: `Bearer ${userAccessToken}` };
				const url = urlPath + userLogId;

				// act
				const response = await lastValueFrom(http.get(url, { headers }));

				// assert
				expect(logSpy).toHaveBeenCalledTimes(1);
				const params = logSpy.mock.calls[0];
				expect(params[0]).toEqual(userContext);
				expect(params[1]).toEqual(new EntityIdDTO(userLogId));
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
				logSpy = jest.spyOn(conditioningDataService, 'fetchLog').mockImplementation(() => { throw new Error('Test Error'); });
				const response$ = http.get(urlPath, { headers });

				// act/assert
				await expect(lastValueFrom(response$)).rejects.toThrow();
			});
		});

		describe('logs', () => {
			let adminContext: UserContext;;
			let adminLogs: ConditioningLog<any, ConditioningLogDTO>[];
			let logsSpy: any;
			let queryDTO: QueryDTO;
			let queryDTOProps: QueryDTOProps;
			let userLogs: ConditioningLog<any, ConditioningLogDTO>[];
			let url: string;
			beforeEach(() => {
				adminContext = new UserContext(adminProps);

				adminLogs = [
					{ activity: 'SWIM' },
					{ activity: 'BIKE' },
					{ activity: 'RUN' },
					{ activity: 'MTB' },
					{ activity: 'MTB' },
				] as unknown as ConditioningLog<any, ConditioningLogDTO>[];

				userLogs = [
					{ activity: 'SWIM' },
					{ activity: 'RUN' },
					{ activity: 'MTB' },
				] as unknown as ConditioningLog<any, ConditioningLogDTO>[];
				
				queryDTOProps = {
					start: '2021-01-01',
					end: '2021-12-31',
					activity: ActivityType.MTB,
					userId: userContext.userId as unknown as string,
					sortBy: 'duration',
					order: 'ASC',
					page: 1,
					pageSize: 10,
				};

				queryDTO = new QueryDTO(queryDTOProps);

				logsSpy = jest.spyOn(conditioningDataService, 'fetchLogs')
					.mockImplementation((ctx: any, query?: any): any => { // todo: refactor service to use QueryDTO and UserContext
						if (ctx.roles?.includes('admin')) { // simulate an admin user requesting logs
							if (!query || !query?.userId) { // simulate a missing query or query not specifying user id
								return Promise.resolve(adminLogs); // return all logs for all users
							}
							else { // simulate a query matching single user
								return Promise.resolve([adminLogs[0]]); // admins can access all logs, so return first (i.e. 'matching) log
							}
						}
						else if(ctx.roles?.includes('user')) { // simulate a normal user requesting logs
							if (!query) {
								return Promise.resolve(userLogs); // query not provided: return all logs for user
							}
							else if (query.userId !== userContext.userId ) { // if query with user id is provided, query user id must match that in the access token
								throw new ForbiddenException('User not authorized to access logs'); // throw an error
							}
							else if (Object.keys(query).length === 1) { // simulate a query with only a user id
								return Promise.resolve(userLogs); // return all logs for user
							}
							else { // simulate a query with additional criteria
								return Promise.resolve([userLogs[0]]); // return first (i.e. 'matching) log for user
							}
						}
						// else throw error if user has no roles
						throw new ForbiddenException('User not authorized to access logs'); // throw an error
					});

				url = `${serverUrl}/logs`;
			});

			afterEach(() => {
				logsSpy && logsSpy.mockRestore();
				jest.clearAllMocks();
			});

			it('gives normal users access to a collection of all their conditioning logs', async () => {
				// arrange
				const response = await lastValueFrom(http.get(url, { headers }));
				
				// assert
				expect(true).toBeTruthy(); // debug
				expect(logsSpy).toHaveBeenCalledTimes(1);
				expect(logsSpy).toHaveBeenCalledWith(userContext, undefined);
				expect(response?.data).toBeDefined();
				expect(response?.data).toEqual(userLogs);
			});

			it('optionally gives normal users access to their logs matching a query', async () => {
				// arrange
				
				// act
				const response = await lastValueFrom(http.get(url, { params: queryDTOProps, headers }));
				
				// assert
				expect(logsSpy).toHaveBeenCalledTimes(1);
				expect(logsSpy).toHaveBeenCalledWith(userContext, queryDTO);
				expect(response?.data).toBeDefined();
				expect(response?.data).toEqual([userLogs[0]]);
			});

			it('gives admin users access to all logs for all users', async () => {
				// arrange
				const headers = { Authorization: `Bearer ${adminAccessToken}` };
				
				// act
				const response = await lastValueFrom(http.get(url, { headers }));

				// assert
				expect(logsSpy).toHaveBeenCalledTimes(1);
				expect(logsSpy).toHaveBeenCalledWith(adminContext, undefined);
				expect(response?.data).toBeDefined();
				expect(response?.data).toEqual(adminLogs);
			});

			it('optionally gives admin users access to logs matching a query', async () => {
				// arrange
				const headers = { Authorization: `Bearer ${adminAccessToken}` };

				// act
				const response = await lastValueFrom(http.get(url, { params: queryDTOProps, headers }));

				// assert
				expect(logsSpy).toHaveBeenCalledTimes(1);
				expect(logsSpy).toHaveBeenCalledWith(adminContext, queryDTO);
				expect(response?.data).toBeDefined();
				expect(response?.data).toEqual([adminLogs[0]]);
			});
			
			it('fails if access token is missing', async () => {
				// arrange
				const response$ = http.get(url, { params: queryDTOProps });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if access token is invalid', async () => {
				// arrange
				const invalidHeaders = { Authorization: `Bearer invalid` };
				const response$ = http.get(url, { params: queryDTOProps, headers: invalidHeaders });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if query is present but has invalid data', async () => {
				// arrange
				queryDTOProps.start = 'invalid'; // invalid date
				const response$ = http.get(url, { params: queryDTOProps, headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if query is present but has non-whitelisted properties', async () => {
				// arrange
				(queryDTOProps as any).invalid = 'invalid'; // invalid property
				const response$ = http.get(url, { params: queryDTOProps, headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if roles claim is missing', async () => {
				// arrange
				delete userPayload.roles;
				const accessToken = await jwt.sign(userPayload);
				const headers = { Authorization: `Bearer ${accessToken}` };
				const response$ = http.get(url, { params: queryDTOProps, headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('fails if roles claim is invalid', async () => {
				// arrange
				userPayload.roles = ['invalid'];
				const accessToken = await jwt.sign(userPayload);
				const headers = { Authorization: `Bearer ${accessToken}` };
				const response$ = http.get(url, { params: queryDTOProps, headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});
		});

		describe('rules', () => {
			let url: string;
			let urlPath: string;
			beforeEach(() => {
				url = `${serverUrl}/rules/`;
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
			it('provides a collection of conditioning data ("sessions")', async () => {
				// arrange
				const spy = jest.spyOn(conditioningDataService, 'conditioningData');

				// act
				void await appController.sessions();
				
				// assert
				expect(spy).toHaveBeenCalledTimes(1);
				expect(spy).toHaveBeenCalledWith();

				// cleanup
				spy && spy.mockRestore();
			});
		});
	});
});
