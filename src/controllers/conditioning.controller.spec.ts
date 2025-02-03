import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ForbiddenException, INestApplication } from '@nestjs/common';

import { jest } from '@jest/globals';
import { of, lastValueFrom } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { ConsoleLogger, EntityId, Logger, Result } from '@evelbulgroz/ddd-base';
import { ActivityType } from '@evelbulgroz/fitnessapp-base';

import { AggregationQueryDTO } from '../dtos/sanitization/aggregation-query.dto';
import { AggregationQueryDTOProps }	from '../test/models/aggregation-query-dto.props';
import { ConditioningController } from './conditioning.controller';
import { BcryptCryptoService } from '../services/crypto/bcrypt-crypto.service';
import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { createTestingModule } from '../test/test-utils';
import { CryptoService } from '../services/crypto/models/crypto-service.model';
import { EntityIdDTO } from '../dtos/sanitization/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';
import { JwtSecretService } from '../services/jwt/jwt-secret.service';
import { JwtService } from '../services/jwt/models/jwt-service.model';
import { JsonWebtokenService } from '../services/jwt/json-webtoken.service';
import { QueryDTO } from '../dtos/sanitization/query.dto';
import { QueryDTOProps } from '../test/models/query-dto.props';
import { UserContext, UserContextProps } from '../domain/user-context.model';
import { UserJwtPayload } from '../services/jwt/models/user-jwt-payload.model';
import { UserRepository } from '../repositories/user.repo';
import { ValidationPipe } from './pipes/validation.pipe';

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// NOTE:
  // Testing over http to enable decorators and guards without having to do a ton of additional setup/mocking.
  // This also ensures request/response objects are correctly formatted and that the controller is correctly configured.
  // Otherwise, this suite tests the controller in isolation from the rest of the application, i.e. as a unit test.

describe('ConditioningController', () => {
	let app: INestApplication;
	let appController: ConditioningController;
	let conditioningDataService: ConditioningDataService;
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
				{ // Logger
					provide: Logger,
					useClass: ConsoleLogger,
				},
				{ // Data service
					provide: ConditioningDataService,
					useValue: {
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
		appController = module.get<ConditioningController>(ConditioningController);
		conditioningDataService = module.get<ConditioningDataService>(ConditioningDataService);
		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		http = module.get<HttpService>(HttpService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository>(UserRepository);

		app.useGlobalPipes(new ValidationPipe());
		await app.listen(0); // enter 0 to let the OS choose a free port

		const port = app.getHttpServer().address().port; // random port, e.g. 60703
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

				url = `${baseUrl}/activities`;
			});

			afterEach(() => {
				logsSpy && logsSpy.mockRestore();
				jest.clearAllMocks();
			});
			
			it('provides summary of conditioning activities performed by type', async () => {
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
				aggregationSpy = jest.spyOn(conditioningDataService, 'fetchAggretagedLogs')
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
				describe('create', () => {
					let newLogDto: ConditioningLogDTO;
					let logSpy: any;
					let newLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						newLogId = uuid();
						newLogDto = {
							activity: ActivityType.SWIM,
							isOverview: true,
							duration: { value: 3600, unit: 's' },
							className: 'ConditioningLog'
						}
						logSpy = jest.spyOn(conditioningDataService, 'createLog')
							.mockImplementation((ctx: any, userIdDTO: EntityIdDTO, log: ConditioningLogDTO) => {
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

					it('creates a new conditioning log and returns its unique id', async () => {
						// arrange
						headers = { Authorization: `Bearer ${userAccessToken}` };

						// act
						const response = await lastValueFrom(http.post(url, newLogDto, { headers }));
						
						// assert
						expect(logSpy).toHaveBeenCalledTimes(1);
						const params = logSpy.mock.calls[0];
						expect(params[0]).toEqual(userContext);
						expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
						expect(params[2]).toEqual(newLogDto);
						
						expect(response?.data).toBeDefined();
						expect(response?.data).toEqual(newLogId);
					});

					it('throws if access token is missing', async () => {
						// arrange
						const response$ = http.post(url, newLogDto);

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if access token is invalid', async () => {
						// arrange
						const invalidHeaders = { Authorization: `Bearer invalid` };
						const response$ = http.post(url, newLogDto, { headers: invalidHeaders });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user information in token payload is invalid', async () => {
						// arrange
						userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
						const userAccessToken = await jwt.sign(adminPayload);
						const response$ = http.post(url, newLogDto, { headers: { Authorization: `Bearer ${userAccessToken}` } });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user id is missing', async () => {
						// arrange
						const response$ = http.post(urlPath, newLogDto, { headers });

						// act/assert
						expect(async () => await lastValueFrom(response$)).rejects.toThrow();
					});

					it('throws if user id is invalid', async () => {
						// arrange
						const response$ = http.post(urlPath + 'invalid', newLogDto, { headers });

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
						logSpy = jest.spyOn(conditioningDataService, 'createLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.post(urlPath, newLogDto, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('retrieve', () => {
					let log: ConditioningLog<any, ConditioningLogDTO>;
					let logId: EntityId;
					let logSpy: any;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						log = { activity: 'SWIM' } as unknown as ConditioningLog<any, ConditioningLogDTO>;
						logId = uuid();
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
						logSpy = jest.spyOn(conditioningDataService, 'fetchLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.get(urlPath, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('update', () => {
					let logSpy: any;
					let updatedLogDto: ConditioningLogDTO;
					let updatedLog: ConditioningLog<any, ConditioningLogDTO>;
					let updatedLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						updatedLogId = uuid();
						updatedLogDto = {
							activity: ActivityType.SWIM,
							isOverview: true,
							duration: { value: 3600, unit: 's' },
							className: 'ConditioningLog'
						};
						updatedLog = ConditioningLog.create(updatedLogDto).value as ConditioningLog<any, ConditioningLogDTO>;
						const entityIdDTO = new EntityIdDTO(updatedLogId);
						logSpy = jest.spyOn(conditioningDataService, 'updateLog')
							.mockImplementation((ctx: UserContext, userIdDTO: EntityIdDTO, logIdDTO: EntityIdDTO, logDTO: Partial<ConditioningLogDTO>) => {
								void ctx, userIdDTO, logIdDTO, logDTO; // suppress unused variable warning
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
						try {
							const response = await lastValueFrom(http.patch(url, updatedLogDto, { headers }));

							// assert
							expect(logSpy).toHaveBeenCalledTimes(1);
							const params = logSpy.mock.calls[0];
							expect(params[0]).toEqual(userContext);
							expect(params[1]).toEqual(new EntityIdDTO(userContext.userId));
							expect(params[2]).toEqual(new EntityIdDTO(updatedLogId));
							expect(params[3]).toEqual(updatedLogDto);
							
							expect(response?.data).toBeDefined();
							expect(response?.data).toBe(""); // void response returned as empty string
						}
						catch (error) {
							console.log(error.message);
						}
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
						logSpy = jest.spyOn(conditioningDataService, 'updateLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.put(urlPath, updatedLogDto, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});

				describe('delete', () => {
					let logSpy: any;
					let deletedLogId: EntityId;
					let url: string;
					let urlPath: string;
					beforeEach(() => {
						deletedLogId = uuid();
						//const entityIdDTO = new EntityIdDTO(deletedLogId);
						logSpy = jest.spyOn(conditioningDataService, 'deleteLog')
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
						logSpy = jest.spyOn(conditioningDataService, 'deleteLog').mockImplementation(() => { throw new Error('Test Error'); });
						const response$ = http.delete(urlPath, { headers });

						// act/assert
						await expect(lastValueFrom(response$)).rejects.toThrow();
					});
				});
			});
		
			describe('multiple logs', () => {
				let adminContext: UserContext;;
				let adminLogs: ConditioningLog<any, ConditioningLogDTO>[];
				let logsSpy: any;
				let queryDTO: QueryDTO;
				let queryDTOProps: QueryDTOProps;
				let userIdDTO: EntityIdDTO;
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
						.mockImplementation((ctx: any, userIdDTO: EntityIdDTO, query?: any): any => { // todo: refactor service to use QueryDTO and UserContext
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

					
					userIdDTO = new EntityIdDTO(userContext.userId);

					const urlPath = `${baseUrl}/logs`;
					url = `${urlPath}/${userContext.userId}`;
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
					expect(logsSpy).toHaveBeenCalledWith(userContext, userIdDTO, undefined);
					expect(response?.data).toBeDefined();
					expect(response?.data).toEqual(userLogs);
				});

				it('optionally gives normal users access to their logs matching a query', async () => {
					// arrange
					
					// act
					const response = await lastValueFrom(http.get(url, { params: queryDTOProps, headers }));
					
					// assert
					expect(logsSpy).toHaveBeenCalledTimes(1);
					expect(logsSpy).toHaveBeenCalledWith(userContext, userIdDTO, queryDTO);
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
					expect(logsSpy).toHaveBeenCalledWith(adminContext, userIdDTO, undefined);
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
					expect(logsSpy).toHaveBeenCalledWith(adminContext, userIdDTO, queryDTO);
					expect(response?.data).toBeDefined();
					expect(response?.data).toEqual([adminLogs[0]]);
				});
				
				it('throws error if access token is missing', async () => {
					// arrange
					const response$ = http.get(url, { params: queryDTOProps });

					// act/assert
					expect(async () => await lastValueFrom(response$)).rejects.toThrow();
				});

				it('throws error if access token is invalid', async () => {
					// arrange
					const invalidHeaders = { Authorization: `Bearer invalid` };
					const response$ = http.get(url, { params: queryDTOProps, headers: invalidHeaders });

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
					const response$ = http.get(url, { params: queryDTOProps, headers });

					// act/assert
					expect(async () => await lastValueFrom(response$)).rejects.toThrow();
				});

				it('throws error if query is present but has non-whitelisted properties', async () => {
					// arrange
					(queryDTOProps as any).invalid = 'invalid'; // invalid property
					const response$ = http.get(url, { params: queryDTOProps, headers });

					// act/assert
					expect(async () => await lastValueFrom(response$)).rejects.toThrow();
				});

				it('throws error if roles claim is missing', async () => {
					// arrange
					delete userPayload.roles;
					const accessToken = await jwt.sign(userPayload);
					const headers = { Authorization: `Bearer ${accessToken}` };
					const response$ = http.get(url, { params: queryDTOProps, headers });

					// act/assert
					expect(async () => await lastValueFrom(response$)).rejects.toThrow();
				});

				it('throws error if roles claim is invalid', async () => {
					// arrange
					userPayload.roles = ['invalid'];
					const accessToken = await jwt.sign(userPayload);
					const headers = { Authorization: `Bearer ${accessToken}` };
					const response$ = http.get(url, { params: queryDTOProps, headers });

					// act/assert
					expect(async () => await lastValueFrom(response$)).rejects.toThrow();
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
