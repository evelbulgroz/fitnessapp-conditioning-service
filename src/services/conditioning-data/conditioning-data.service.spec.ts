import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createTestingModule } from '../../test/test-utils';

import { jest } from '@jest/globals';

import { firstValueFrom, Observable, of, Subject, Subscription, take } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { ActivityType, DeviceType, SensorType } from '@evelbulgroz/fitnessapp-base';
import { AggregationType, SampleRate } from '@evelbulgroz/time-series';
import { ConsoleLogger, EntityId, Logger, Result } from '@evelbulgroz/ddd-base';
import { Query } from '@evelbulgroz/query-fns';

import { AggregationQueryDTO } from '../../dtos/sanitization/aggregation-query.dto';
import { AggregatorService } from '../../services/aggregator/aggregator.service';
import { ConditioningDataService } from './conditioning-data.service';
import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../../repositories/conditioning-log.repo';
import { EntityIdDTO } from '../../dtos/sanitization/entity-id.dto';
import { EventDispatcher } from '../../services/event-dispatcher/event-dispatcher.service';
import { ConditioningLogCreatedHandler } from '../../handlers/conditioning-log-created.handler';
import { ConditioningLogDeletedHandler } from '../../handlers/conditioning-log-deleted.handler';
import { ConditioningLogUndeletedHandler } from '../../handlers/conditioning-log-undeleted.handler';
import { ConditioningLogUpdatedEvent } from '../../events/conditioning-log-updated.event';
import { ConditioningLogUpdateHandler } from '../../handlers/conditioning-log-updated.handler';
import { UserCreatedHandler } from '../../handlers/user-created.handler';
import { UserDeletedHandler } from '../../handlers/user-deleted.handler';
import { UserUpdatedEvent } from '../../events/user-updated.event';
import { UserUpdatedHandler } from '../../handlers/user-updated.handler';
import { NotFoundError } from '../../domain/not-found.error';
import { PersistenceError } from '../../domain/persistence.error';
import { QueryDTO } from '../../dtos/sanitization/query.dto';
import { QueryDTOProps } from '../../test/models/query-dto.props';
import { QueryMapper } from '../../mappers/query.mapper';
import { UnauthorizedAccessError } from '../../domain/unauthorized-access.error';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../domain/user-context.model';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user.repo';

const originalTimeout = 5000;
//jest.setTimeout(15000);
//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

describe('ConditioningDataService', () => {
	// set up test environment and dependencies/mocks, and initialize the module
	let aggregatorService: AggregatorService;
	let app: TestingModule;
	let logService: ConditioningDataService;
	let logger: Logger;
	let logRepo: ConditioningLogRepository<any, ConditioningLogDTO>;
	let logRepoUpdatesSubject: Subject<any>;
	let queryMapper: QueryMapper<Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>, QueryDTO>;
	let userRepo: UserRepository;
	let userRepoUpdatesSubject: Subject<any>;
	beforeEach(async () => {
		logRepoUpdatesSubject = new Subject<any>();
		userRepoUpdatesSubject = new Subject<any>();
		
		app = await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				{
					provide: AggregatorService,
					useValue: {
						aggregate: jest.fn()
					}
				},
				ConfigService,
				EventDispatcher,
				ConditioningLogCreatedHandler,
				ConditioningLogDeletedHandler,
				ConditioningLogUpdateHandler,
				ConditioningLogUndeletedHandler,
				UserCreatedHandler,
				UserDeletedHandler,
				UserUpdatedHandler,
				ConditioningDataService,
				{
					provide: ConditioningLogRepository,
					useValue: {
						create: jest.fn(),
						delete: jest.fn(),
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
						update: jest.fn(),
						updates$: logRepoUpdatesSubject.asObservable(),
						undelete: jest.fn(),
					}
				},
				{
					provide: Logger,
					useClass: ConsoleLogger
				},
				QueryMapper,
				{
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				},
				{
					provide: UserRepository,
					useValue: {
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
						update: jest.fn(),
						updates$: userRepoUpdatesSubject.asObservable(),
						undelete: jest.fn(),
					}
				}
			],
		});
		aggregatorService = app.get<AggregatorService>(AggregatorService);
		logService = app.get<ConditioningDataService>(ConditioningDataService);
		logger = app.get<Logger>(Logger);
		logRepo = app.get<ConditioningLogRepository<any, ConditioningLogDTO>>(ConditioningLogRepository);
		queryMapper = app.get<QueryMapper<Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>, QueryDTO>>(QueryMapper);
		userRepo = app.get<UserRepository>(UserRepository);
	});
	
	// set up test data and spies		
	let logDTO: ConditioningLogDTO;
	let logRepoFetchAllSpy: any;
	const subs: Subscription[] = [];
	let testDTOs: ConditioningLogDTO[];
	let userRepoFetchAllSpy: any;	
	beforeEach(async () => {
		logDTO = <ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
			entityId: uuidv4(),
			meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20200806-090329"
				}
			},
			isOverview: false,
			start: "2020-08-06T07:03:29.000Z",
			end: "2020-08-06T07:04:49.000Z",
			activity: ActivityType.BIKE,
			activityOrder: 0,
			duration: {value: 80000, unit: "ms"},
			className: "ConditioningLog",
			activities: [],
			laps: [],
			note: "test note",
			sensorLogs: [
				{
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data:[
						{
							timeStamp: "2020-08-06T07:03:29.000Z",
							value: {value: 7, unit: "m"},
						},
						{
							timeStamp: "2020-08-06T07:03:39.000Z",
							value: {value: 9, unit: "m"},
						},
						{
							timeStamp: "2020-08-06T07:03:49.000Z",
							value: {value: 9, unit: "m"},
						}
					]
				},
				{
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
						{
							timeStamp: "2020-08-06T07:03:59.000Z",
							value: {value: 99, unit: "bpm"},
						},
						{
							timeStamp: "2020-08-06T07:04:09.000Z",
							value: {value: 95, unit: "bpm"},
						},
						{
							timeStamp: "2020-08-06T07:04:19.000Z",
							value: {value: 103, unit: "bpm"},
						}
					]
				},
				{
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data:[
						{
							timeStamp: "2020-08-06T07:04:29.000Z",
							value: {value: 30.402, unit: "km/h"},
						},
						{
							timeStamp: "2020-08-06T07:04:39.000Z",
							value: {value: 34.1352, unit: "km/h"},
						},
						{
							timeStamp: "2020-08-06T07:04:49.000Z",
							value: {value: 22.4172, unit: "km/h"},
						},
					],
				}
			]
		};

		testDTOs = [
			<ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
				entityId: uuidv4(),
				meta: {
					sourceId: {
						source: DeviceType.SUUNTO_T6,
						id: "20200806-090329"
					}
				},
				isOverview: false,
				start: "2020-08-06T07:03:29.000Z",
				end: "2020-08-06T07:04:49.000Z",
				activity: ActivityType.MTB,
				activityOrder: 0,
				duration: {value: 80000, unit: "ms"},
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "test note 1",
				sensorLogs: [
					{
						sensorType: SensorType.ALTITUDE,
						unit: "m",
						data:[
							{
								timeStamp: "2020-08-06T07:03:29.000Z",
								value: {value: 7, unit: "m"},
							},
							{
								timeStamp: "2020-08-06T07:03:39.000Z",
								value: {value: 9, unit: "m"},
							},
							{
								timeStamp: "2020-08-06T07:03:49.000Z",
								value: {value: 9, unit: "m"},
							}
						]
					},
					{
						sensorType: SensorType.HEARTRATE,
						unit: "bpm",
						data: [
							{
								timeStamp: "2020-08-06T07:03:59.000Z",
								value: {value: 99, unit: "bpm"},
							},
							{
								timeStamp: "2020-08-06T07:04:09.000Z",
								value: {value: 95, unit: "bpm"},
							},
							{
								timeStamp: "2020-08-06T07:04:19.000Z",
								value: {value: 103, unit: "bpm"},
							}
						]
					},
					{
						sensorType: SensorType.SPEED,
						unit: "km/h",
						data:[
							{
								timeStamp: "2020-08-06T07:04:29.000Z",
								value: {value: 30.402, unit: "km/h"},
							},
							{
								timeStamp: "2020-08-06T07:04:39.000Z",
								value: {value: 34.1352, unit: "km/h"},
							},
							{
								timeStamp: "2020-08-06T07:04:49.000Z",
								value: {value: 22.4172, unit: "km/h"},
							},
						],
					}
				]
			},
			<ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
				entityId: uuidv4(),
				meta: {
					sourceId: {
						source: DeviceType.SUUNTO_T6,
						id: "20201008-190329"
					}
				},
				isOverview: false,
				start: "2020-09-16T07:03:29.000Z",
				end: "2020-09-16T07:04:49.000Z",
				activity: ActivityType.MTB,
				activityOrder: 0,
				duration: {value: 80000, unit: "ms"},
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "test note 2",
				sensorLogs: [
					{
						sensorType: SensorType.ALTITUDE,
						unit: "m",
						data:[
							{
								timeStamp: "2020-10-06T07:03:29.000Z",
								value: {value: 7, unit: "m"},
							},
							{
								timeStamp: "2020-10-06T07:03:39.000Z",
								value: {value: 9, unit: "m"},
							},
							{
								timeStamp: "2020-10-06T07:03:49.000Z",
								value: {value: 9, unit: "m"},
							}
						]
					},
					{
						sensorType: SensorType.HEARTRATE,
						unit: "bpm",
						data: [
							{
								timeStamp: "2020-10-06T07:03:59.000Z",
								value: {value: 99, unit: "bpm"},
							},
							{
								timeStamp: "2020-10-06T07:04:09.000Z",
								value: {value: 95, unit: "bpm"},
							},
							{
								timeStamp: "2020-10-06T07:04:19.000Z",
								value: {value: 103, unit: "bpm"},
							}
						]
					},
					{
						sensorType: SensorType.SPEED,
						unit: "km/h",
						data:[
							{
								timeStamp: "2020-10-06T07:04:29.000Z",
								value: {value: 30.402, unit: "km/h"},
							},
							{
								timeStamp: "2020-10-06T07:04:39.000Z",
								value: {value: 34.1352, unit: "km/h"},
							},
							{
								timeStamp: "2020-10-06T07:04:49.000Z",
								value: {value: 22.4172, unit: "km/h"},
							},
						],
					}
				]
			},
			<ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
				entityId: uuidv4(),
				meta: {
					sourceId: {
						source: DeviceType.SUUNTO_T6,
						id: "20201206-090329"
					}
				},
				isOverview: false,
				start: "2020-10-06T07:03:29.000Z",
				end: "2020-10-06T07:04:49.000Z",
				activity: ActivityType.RUN,
				activityOrder: 0,
				duration: {value: 80000, unit: "ms"},
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "test note 3",
				sensorLogs: [
					{
						sensorType: SensorType.ALTITUDE,
						unit: "m",
						data:[
							{
								timeStamp: "2020-12-06T07:03:29.000Z",
								value: {value: 7, unit: "m"},
							},
							{
								timeStamp: "2020-12-06T07:03:39.000Z",
								value: {value: 9, unit: "m"},
							},
							{
								timeStamp: "2020-12-06T07:03:49.000Z",
								value: {value: 9, unit: "m"},
							}
						]
					},
					{
						sensorType: SensorType.HEARTRATE,
						unit: "bpm",
						data: [
							{
								timeStamp: "2020-12-06T07:03:59.000Z",
								value: {value: 99, unit: "bpm"},
							},
							{
								timeStamp: "2020-12-06T07:04:09.000Z",
								value: {value: 95, unit: "bpm"},
							},
							{
								timeStamp: "2020-12-06T07:04:19.000Z",
								value: {value: 103, unit: "bpm"},
							}
						]
					},
					{
						sensorType: SensorType.SPEED,
						unit: "km/h",
						data:[
							{
								timeStamp: "2020-12-06T07:04:29.000Z",
								value: {value: 30.402, unit: "km/h"},
							},
							{
								timeStamp: "2020-12-06T07:04:39.000Z",
								value: {value: 34.1352, unit: "km/h"},
							},
							{
								timeStamp: "2020-12-06T07:04:49.000Z",
								value: {value: 22.4172, unit: "km/h"},
							},
						],
					}
				]
			},
			<ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
				entityId: uuidv4(),
				meta: {
					sourceId: {
						source: DeviceType.SUUNTO_T6,
						id: "20201206-090329"
					}
				},
				isOverview: false,
				start: "2020-11-06T07:03:29.000Z",
				end: "2020-11-06T09:04:49.000Z",
				activity: ActivityType.MTB,
				activityOrder: 0,
				duration: {value: 7280000, unit: "ms"},
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "test note 4",
				sensorLogs: [
					{
						sensorType: SensorType.ALTITUDE,
						unit: "m",
						data:[
							{
								timeStamp: "2020-12-06T07:03:29.000Z",
								value: {value: 7, unit: "m"},
							},
							{
								timeStamp: "2020-12-06T07:03:39.000Z",
								value: {value: 9, unit: "m"},
							},
							{
								timeStamp: "2020-12-06T07:03:49.000Z",
								value: {value: 9, unit: "m"},
							}
						]
					},
					{
						sensorType: SensorType.HEARTRATE,
						unit: "bpm",
						data: [
							{
								timeStamp: "2020-12-06T07:03:59.000Z",
								value: {value: 99, unit: "bpm"},
							},
							{
								timeStamp: "2020-12-06T07:04:09.000Z",
								value: {value: 95, unit: "bpm"},
							},
							{
								timeStamp: "2020-12-06T07:04:19.000Z",
								value: {value: 103, unit: "bpm"},
							}
						]
					},
					{
						sensorType: SensorType.SPEED,
						unit: "km/h",
						data:[
							{
								timeStamp: "2020-12-06T07:04:29.000Z",
								value: {value: 30.402, unit: "km/h"},
							},
							{
								timeStamp: "2020-12-06T07:04:39.000Z",
								value: {value: 34.1352, unit: "km/h"},
							},
							{
								timeStamp: "2020-12-06T07:04:49.000Z",
								value: {value: 22.4172, unit: "km/h"},
							},
						],
					}
				]
			},
			<ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
				entityId: uuidv4(),
				meta: {
					sourceId: {
						source: DeviceType.SUUNTO_T6,
						id: "20201206-090329"
					}
				},
				isOverview: false,
				start: "2020-12-06T17:06:29.000Z",
				end: "2020-12-06T18:08:49.000Z",
				activity: ActivityType.MTB,
				activityOrder: 0,
				duration: {value: 3740000, unit: "ms"},
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "test note 4",
				sensorLogs: [
					{
						sensorType: SensorType.ALTITUDE,
						unit: "m",
						data:[
							{
								timeStamp: "2020-12-06T07:03:29.000Z",
								value: {value: 7, unit: "m"},
							},
							{
								timeStamp: "2020-12-06T07:03:39.000Z",
								value: {value: 9, unit: "m"},
							},
							{
								timeStamp: "2020-12-06T07:03:49.000Z",
								value: {value: 9, unit: "m"},
							}
						]
					},
					{
						sensorType: SensorType.HEARTRATE,
						unit: "bpm",
						data: [
							{
								timeStamp: "2020-12-06T07:03:59.000Z",
								value: {value: 99, unit: "bpm"},
							},
							{
								timeStamp: "2020-12-06T07:04:09.000Z",
								value: {value: 95, unit: "bpm"},
							},
							{
								timeStamp: "2020-12-06T07:04:19.000Z",
								value: {value: 103, unit: "bpm"},
							}
						]
					},
					{
						sensorType: SensorType.SPEED,
						unit: "km/h",
						data:[
							{
								timeStamp: "2020-12-06T07:04:29.000Z",
								value: {value: 30.402, unit: "km/h"},
							},
							{
								timeStamp: "2020-12-06T07:04:39.000Z",
								value: {value: 34.1352, unit: "km/h"},
							},
							{
								timeStamp: "2020-12-06T07:04:49.000Z",
								value: {value: 22.4172, unit: "km/h"},
							},
						],
					}
				]
			}
		];

		logRepoFetchAllSpy = jest.spyOn(logRepo, 'fetchAll')
			.mockImplementation(() => {
				return Promise.resolve(
					Result.ok(of(testDTOs
						.map(dto => ConditioningLog.create(dto, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>)))
				);
			});

		const logIds = testDTOs.map(dto => dto.entityId);
		const middleIndex = Math.floor(logIds.length / 2);
		const firstHalfOfLogIds = logIds.slice(0, middleIndex);
		const secondHalfOfLogIds = logIds.slice(middleIndex);

		userRepoFetchAllSpy = jest.spyOn(userRepo, 'fetchAll').mockImplementation(() => Promise.resolve(Result.ok(of([
			User.create(
				<UserDTO>{
					entityId: uuidv4(),
					userId: 'testuser1', // id in user microservice, usually a uuid
					logs: firstHalfOfLogIds,
				}
			).value as unknown as User,
			User.create(
				<UserDTO>{
					entityId: uuidv4(),
					userId: 'testuser2', // id in user microservice, usually a uuid
					logs: secondHalfOfLogIds,
				}
			).value as unknown as User,
		]))));
	});

	// set up random test data, initialize service
	let randomLog: ConditioningLog<any, ConditioningLogDTO>;
	let randomLogIdDTO: EntityIdDTO;
	let randomUser: User;
	let randomUserId: EntityId;
	let randomUserIdDTO: EntityIdDTO;
	let logsForRandomUser: ConditioningLog<any, ConditioningLogDTO>[];
	let users: User[];
	let userContext: UserContext;
	beforeEach(async () => {
		// arrange
		void await logService.isReady();			
		
		const users$ = (await userRepo.fetchAll()).value as Observable<User[]>;		
		users = await firstValueFrom(users$);
		randomUserId = users[Math.floor(Math.random() * users.length)].userId;
		randomUserIdDTO = new EntityIdDTO(randomUserId);
		randomUser = users.find(user => user.userId === randomUserId)!;

		userContext = new UserContext({
			userId: randomUser.userId,
			userName: 'evelbulgroz', // display name for user, or service name if user is a service account (subName from JWTPayload)
			userType: 'user',
			roles: ['user']
		});
		
		logsForRandomUser = logService['cache'].value.find(entry => entry.userId === randomUserId)?.logs || [];
		randomLog = logsForRandomUser[Math.floor(Math.random() * logsForRandomUser.length)] as ConditioningLog<any, ConditioningLogDTO>;
		randomLogIdDTO = new EntityIdDTO(randomLog.entityId!);
	});	

	// set up spies for fetchById methods
	let logRepoFetchByIdSpy: any
	let userRepoFetchByIdSpy: any;
	beforeEach(async () => {
		logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
			return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(randomLog)));
		});
		
		userRepoFetchByIdSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() =>
			Promise.resolve(Result.ok(of(randomUser)))
		);
	});

	// tear down test environment
	afterEach(async () => {
		logRepoFetchAllSpy?.mockRestore();
		logRepoFetchByIdSpy?.mockRestore();
		userRepoFetchAllSpy?.mockRestore();
		userRepoFetchByIdSpy?.mockRestore
		subs.forEach(sub => sub?.unsubscribe());
		jest.clearAllMocks();
		
		jest.setTimeout(originalTimeout);
		await app.close(); // close the module to trigger onModuleDestroy()
	});

	it('can be created', () => {
		expect(logService).toBeTruthy();
	});

	describe('Initialization', () => {
		it('reports if/when it is initialized (i.e. ready)', async () => {
			// arrange
			logService['cache'].next([]); // force re-initialization
			expect(logService['cache']).toBeDefined(); // sanity checks
			expect(logService['cache'].value.length).toBe(0);

			// act
			const isReady = await logService.isReady();

			// assert
			expect(isReady).toBe(true);
			expect(logService['cache'].value.length).toBeGreaterThan(0);
		});

		it('populates cache with conditioning logs grouped by user id', async () => {
			// arrange
			const expectedIds = users.map(user => user.userId);
			
			// act
			await logService.isReady();
			const cache = logService['cache'].value;
			const cachedIds = cache.map(entry => entry.userId);
			
			// assert
			expect(cache.length).toBe(expectedIds.length);
			expect(cachedIds).toEqual(expect.arrayContaining(expectedIds));
		});

		it('can be initialized multiple times without side effects', async () => {
			// arrange
			expect(logService['cache']).toBeDefined(); // sanity checks			
			expect(logService['cache'].value.length).toBe(users.length)
			const expectedLength = logService['cache'].value.length;
			const expectedIds = users.map(user => user.userId);

			// act			
			await logService.isReady();
			await logService.isReady();
			await logService.isReady();
			const cachedIds = logService['cache'].value.map(entry => entry.userId);

			// assert
			expect(logService['cache'].value.length).toBe(expectedLength);
			expect(cachedIds).toEqual(expect.arrayContaining(expectedIds));
		});
	});	

	describe('Public API', () => {
		let aggregationQueryDTO: AggregationQueryDTO;
		let aggregatorSpy: any;
		let userIdDTO: EntityIdDTO;
		beforeEach(async () => {
			aggregationQueryDTO = new AggregationQueryDTO({
				aggregatedType: 'ConditioningLog',
				aggregatedProperty: 'duration',
				aggregationType: AggregationType.SUM,
				sampleRate: SampleRate.DAY,
				aggregatedValueUnit: 'ms',				
			});

			aggregatorSpy = jest.spyOn(aggregatorService, 'aggregate')
				.mockImplementation((timeseries, query, extractor) => {
					void timeseries, query, extractor; // suppress unused variable warning
					return {} as any
				});

			userIdDTO = new EntityIdDTO(userContext.userId);

			await logService.isReady();
		});
		
		afterEach(() => {
			aggregatorSpy && aggregatorSpy.mockRestore();
		});

		describe('isReady', () => {		
			it('reports if/when it is initialized (i.e. ready)', async () => {
				// arrange
				logService['cache'].next([]); // force re-initialization
				expect(logService['cache']).toBeDefined(); // sanity checks
				expect(logService['cache'].value.length).toBe(0);

				// act
				const isReady = await logService.isReady();

				// assert
				expect(isReady).toBe(true);
				expect(logService['cache'].value.length).toBeGreaterThan(0);
			});
		});
		
		describe('conditioningData', () => {
			it('can provide a collection of ConditioningDataSeries for all users', async () => {
				// act
				const data = await logService.conditioningData();
				
				// assert
				expect(data).toBeDefined();
				expect(data!.dataseries).toBeDefined();
				expect(Array.isArray(data!.dataseries)).toBe(true);
				expect(data!.dataseries.length).toBeGreaterThan(0);

				const testSeries = data!.dataseries.find(series => series.label === ActivityType.MTB);
				expect(testSeries).toBeDefined();
				expect(testSeries!.data).toBeInstanceOf(Array);
				expect(testSeries!.data.length).toBeGreaterThan(1);
				
				const allDataPoints = data!.dataseries.reduce((acc, series) => acc + series.data.length, 0);
				expect(allDataPoints).toBe(5); // todo: calculate expected value to make it more robust	against changes to test data
			});

			it('can provide a collection of ConditioningDataSeries for a single user by id', async () => {
				const data = await logService.conditioningData(randomUserId);
				
				expect(data).toBeDefined();
				expect(data!.dataseries).toBeDefined();
				expect(Array.isArray(data!.dataseries)).toBe(true);
				expect(data!.dataseries.length).toBeGreaterThan(0);

				const testSeries = data!.dataseries.find(series => series.label === ActivityType.MTB);
				expect(testSeries).toBeDefined();
				expect(testSeries!.data).toBeInstanceOf(Array);
				expect(testSeries!.data.length).toBeGreaterThan(1);

				const allDataPoints = data!.dataseries.reduce((acc, series) => acc + series.data.length, 0);
				expect(allDataPoints).toBeGreaterThan(0); // todo: calculate expected value to make it more robust	against changes to test data
			});
			
			describe('each ConditioningDataSeries', () => {
				it('has an activity id', async () => {
					const data = await logService.conditioningData(randomUserId);
					expect(typeof data.dataseries[0].activityId).toBe('number');
				});

				it('has a series label', async () => {
					const data = await logService.conditioningData(randomUserId);
					expect(typeof data.dataseries[0].label).toBe('string');
				});

				it('has a measurement unit', async () => {
					const data = await logService.conditioningData(randomUserId);
					expect(typeof data.dataseries[0].unit).toBe('string');
				});

				it('has a collection of data points', async () => {
					const data = await logService.conditioningData(randomUserId);
					expect(data.dataseries[0].data).toBeDefined();
					expect(Array.isArray(data.dataseries[0].data)).toBe(true);
				});
		
				describe('each data point', () => {
					it('has a time stamp that is either a number or a Date', async () => {
						const data = await logService.conditioningData(randomUserId);
						const timeStamp = data.dataseries[0].data[0].timeStamp;
						expect(typeof timeStamp === 'number' || timeStamp.constructor.name === 'Date').toBe(true);
					});

					it('has a value that is a number', async () => {
						const data = await logService.conditioningData(randomUserId);
						const value = data.dataseries[0].data[0].value;
						expect(typeof value).toBe('number');
					});
				});			
			});
		});

		describe('createLog', () => {
			let existingUserLogIds: EntityId[];
			let newLog: ConditioningLog<any, ConditioningLogDTO>;
			let newLogId: string;
			let newLogDTO: ConditioningLogDTO;
			let logRepoCreateSpy: any;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				existingUserLogIds = logsForRandomUser.map(log => log.entityId!);
				newLogId = uuidv4();				
				newLogDTO = testDTOs[Math.floor(Math.random() * testDTOs.length)];	
				newLogDTO.entityId = newLogId;
				newLog = ConditioningLog.create(newLogDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logRepoCreateSpy = jest.spyOn(logRepo, 'create').mockImplementation(() => {
					return Promise.resolve(Result.ok<ConditioningLog<any, ConditioningLogDTO>>(newLog!))
				});

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
			});

			afterEach(() => {
				logRepoCreateSpy?.mockRestore();
				userRepoUpdateSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('creates a new log from a DTO and assigns it a unique id', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				const returnedLogId = await logService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(typeof returnedLogId).toBe('string');
				expect(existingUserLogIds).not.toContain(returnedLogId);
			});

			it('persists new log in repo', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				void await logService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(logRepoCreateSpy).toHaveBeenCalledTimes(1);
				expect(logRepoCreateSpy).toHaveBeenCalledWith(newLogDTO);
			});

			it('adds new log to user and persists user changes in repo', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				void await logService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(randomUser.toDTO());
			});

			it('adds new log to cache entry', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				const randomUserDTO = randomUser.toDTO();
				randomUserDTO.logs!.push(newLogId);

				const createEvent = new UserUpdatedEvent({
					eventId: uuidv4(),
					eventName: UserUpdatedEvent.name,
					occurredOn: (new Date()).toISOString(),
					payload: randomUserDTO,
				});

				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async (id: EntityId) => {
					const newLog = ConditioningLog.create(newLogDTO, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(newLog)));
				});				
				
				const userUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() => {
					userRepoUpdatesSubject.next(createEvent); // simulate event from userRepo.updates$
					return Promise.resolve(Result.ok(randomUser))
				});
				
				
				// act
				void await logService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(randomUser.logs).toContain(newLogId); // sanity check

				const updatedCache$ = logService['cache'].pipe(take(2));
				const updatedCache = await firstValueFrom(updatedCache$);
				const cacheEntry = updatedCache?.find(entry => entry.userId === randomUserId);
				const addedLog = cacheEntry?.logs.find(log => log.entityId === newLogId);
				expect(addedLog).toBeDefined();

				// clean up
				logRepoFetchByIdSpy && logRepoFetchByIdSpy.mockRestore();
				userUpdateSpy && userUpdateSpy.mockRestore();
			});

			it(`succeeds if admin user tries to create a log for another user`, async () => {
				// arrange
				userContext.roles = ['admin'];
				const otherUser = users.find(user => user.userId !== randomUserId)!;
				const otherUserIdDTO = new EntityIdDTO(otherUser.userId);
				
				// act
				const returnedLogId = await logService.createLog(userContext, otherUserIdDTO, newLogDTO);
				
				// assert
				expect(typeof returnedLogId).toBe('string');
				expect(existingUserLogIds).not.toContain(returnedLogId);
			});

			it('throws UnauthorizedAccessError if user tries to create a log for another user', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== randomUserId)!;
				const otherUserIdDTO = new EntityIdDTO(otherUser.userId);
				
				// act/assert
				expect(async () => await logService.createLog(userContext, otherUserIdDTO, newLogDTO)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws NotFoundError if user does not exist in persistence layer', async () => {
				// arrange
				logRepoCreateSpy.mockRestore();
				logRepoCreateSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => {
					return Promise.resolve(Result.fail(new NotFoundError('Test Error')));
				});
				
				// act/assert
				expect(async () => await logService.createLog(userContext, randomUserIdDTO, newLogDTO)).rejects.toThrow(NotFoundError);
			});

			it('throws PersistenceError if log creation fails in persistence layer', async () => {
				// arrange
				logRepoCreateSpy.mockRestore();
				logRepoCreateSpy = jest.spyOn(logRepo, 'create').mockImplementation(() => {
					return Promise.resolve(Result.fail(new PersistenceError('Test Error')));
				});
				
				// act/assert
				expect(async () => await logService.createLog(userContext, randomUserIdDTO, newLogDTO)).rejects.toThrow(PersistenceError);
			});

			xit('throws PersistenceError if updating user fails in persistence layer', async () => {
				// arrange
				jest.clearAllMocks();
				const logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation((id) => { // bug: spy does not get called, deleteOrphanedLog receives undefined Result
					console.debug(`Deleting log with id: ${id}`);
					return Promise.resolve(Result.ok());
				});
				userRepoUpdateSpy.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() => {
					return Promise.resolve(Result.fail(new PersistenceError('Test Error')));
				});
				
				// act/assert
				expect(async () => await logService.createLog(userContext, randomUserIdDTO, newLogDTO)).rejects.toThrow(PersistenceError);
				
				// clean up
				logRepoDeleteSpy?.mockRestore();
			});

			// TODO: Add failure scenarios
		});

		describe('fetchAggretagedLogs', () => {
			// NOTE:
			// not testing that AggregatorService works, just that it is called with the right parameters
			// leave deeper testing of the result to AggregatorService tests to avoid duplication
			
			it('can aggregate a time series of all ConditioningLogs owned by a user', async () => {
				// arrange
				const expectedTimeSeries = logService['toConditioningLogSeries'](await logService.fetchLogs(userContext, userIdDTO));
				
				// act
				const aggregatedSeries = await logService.fetchAggretagedLogs(userContext, aggregationQueryDTO);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalled();
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
				expect(aggregatedSeries).toBeDefined();			
			});
			
			it(`can aggregate a time series of all ConditioningLogs for all users if user role is 'admin'`, async () => {
				// arrange
				userContext.roles = ['admin'];

				// act
				const aggregatedSeries = await logService.fetchAggretagedLogs(userContext, aggregationQueryDTO);
				const expectedTimeSeries = logService['toConditioningLogSeries'](await logService.fetchLogs(userContext, userIdDTO));
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalled();
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
				expect(aggregatedSeries).toBeDefined();
			});
			
			it('aggreates only logs matching query, if provided', async () => {			
				// arrange
				const searchableLogs = logService['cache'].value.find((entry) => entry.userId === userContext.userId)?.logs ?? [];
				const queryDTO = new QueryDTO({'activity': ActivityType.MTB});
				const query = queryMapper.toDomain(queryDTO);
				const matchingLogs = query.execute(searchableLogs);
				const expectedTimeSeries = logService['toConditioningLogSeries'](matchingLogs);

				// act
				const aggregatedSeries = await logService.fetchAggretagedLogs(userContext, aggregationQueryDTO, queryDTO);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalled();
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
				expect(aggregatedSeries).toBeDefined();
			});

			it('by default excludes soft deleted logs', async () => {
				// arrange
				const deletedLog = logsForRandomUser[0];
				deletedLog['_updatedOn'] = undefined;
				deletedLog.deletedOn = new Date(deletedLog.createdOn!.getTime() + 1000);

				userContext.roles = ['admin'];
				const expectedTimeSeries = logService['toConditioningLogSeries'](await logService.fetchLogs(userContext, userIdDTO)); // deleted logs excluded by default
				expectedTimeSeries.data.forEach((dataPoint: any) => expect(dataPoint.value.deletedOn).toBeUndefined()); // sanity check, no deleted logs in expected series
				
				// act
				void await logService.fetchAggretagedLogs(userContext, aggregationQueryDTO);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			});

			it('optionally can include soft deleted logs', async () => {
				// arrange
				const deletedLog = logsForRandomUser[0];
				deletedLog['_updatedOn'] = undefined;
				deletedLog.deletedOn = new Date(deletedLog.createdOn!.getTime() + 1000);

				userContext.roles = ['admin'];
				const expectedTimeSeries = logService['toConditioningLogSeries'](await logService.fetchLogs(userContext, userIdDTO, undefined, true)); // include deleted logs
				expect(expectedTimeSeries.data.some((dataPoint: any) => dataPoint.value.deletedOn !== undefined)).toBe(true); // sanity check, deleted logs in expected series
				
				// act
				void await logService.fetchAggretagedLogs(userContext, aggregationQueryDTO, undefined, true);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			});

			it('throws UnauthorizedAccessError if user tries to access logs of another user', async () => {
				// arrange
				const queryDTO = new QueryDTO({	userId: 'no-such-user'});
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserContext = new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']});
				
				// act/assert
				expect(async () => await logService.fetchAggretagedLogs(otherUserContext, aggregationQueryDTO, queryDTO)).rejects.toThrow(UnauthorizedAccessError);
			});
		});

		describe('fetchLog', () => {
			it('provides details for a conditioning log owned by a user', async () => {
				// arrange
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					randomLog.sensorLogs = []; // if sensorLogs is not undefined, isOverview will be false
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(randomLog)))
				});
				
				//act
				const detailedLog = await logService.fetchLog(userContext, randomUserIdDTO, randomLogIdDTO);

				// assert
				expect(detailedLog!).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.isOverview).toBe(false);
			});
						
			it(`can provide a details for other user's conditioning log if user role is 'admin'`, async () => {
				// arrange
				userContext.roles = ['admin'];
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserLogs = await logService.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];

				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					randomOtherUserLog!.sensorLogs = []; // if sensorLogs is not undefined, isOverview will be false
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(randomOtherUserLog!)))
				});
				
				//act
				const detailedLog = await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomOtherUserLog!.entityId!));

				// assert
				expect(detailedLog!).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.isOverview).toBe(false);
			});

			it('by default excludes soft deleted logs', async () => {
				// arrange
				randomLog['_updatedOn'] = undefined;
				randomLog.deletedOn = new Date(randomLog.createdOn!.getTime() + 1000);
				
				// act
				const detailedLogPromise = logService.fetchLog(userContext, randomUserIdDTO, randomLogIdDTO);
				
				// assert
				expect(async () => await detailedLogPromise).rejects.toThrow(NotFoundError);
			});

			it('optionally can include soft deleted logs', async () => {
				// arrange
				randomLog['_updatedOn'] = undefined;
				randomLog.deletedOn = new Date(randomLog.createdOn!.getTime() + 1000);
				
				// act
				const detailedLog = await logService.fetchLog(userContext, randomUserIdDTO, randomLogIdDTO, true);
				
				// assert
				expect(detailedLog).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.deletedOn).toBeDefined();
			});

			it('returns log directly from cache if already detailed', async () => {
				// arrange
					// reset spy to avoid side effects
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById'); // should not be called
				
					// replace random log in cache with detailed log
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				const cache = logService['cache'].value;
				const cacheEntry = cache.find(entry => entry.userId === randomUserId);
				const logIndex = cacheEntry!.logs.findIndex(log => log.entityId === randomLogId);
				cacheEntry!.logs[logIndex] = detailedLog;				
				
				//act
				const retrievedLog = await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!));

				// assert
				expect(retrievedLog?.entityId).toBe(randomLog?.entityId);
				expect(retrievedLog?.isOverview).toBe(false);
				expect(retrievedLog).toBe(detailedLog);

				expect(logRepoFetchByIdSpy).not.toHaveBeenCalled(); // may/not be reliable, but should be true
			});

			it('retrieves detailed log from persistence if cached log is overview', async () => {
				// arrange
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					//  logs are initialized in cache as overviews, so any random cached log should be an overview
					const randomLogId = randomLog!.entityId!;
					const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
					const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});

				// act
				const retrievedLog = await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!));

				// assert
				expect(retrievedLog?.entityId).toBe(randomLog?.entityId);
				expect(retrievedLog?.isOverview).toBe(false);
			});
			
			it('passes through log from persistence as-is, without checking if details are actually available ', async () => {
				// arrange
					// create a new log with isOverview set to true, and no detailed properties -> should be returned without checking for details
				const detailedLogMock = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () =>
					Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLogMock)))
				);
				
				//act
				const retrievedLog = await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!));

				// assert
				expect(retrievedLog?.isOverview).toBe(true);
			});
			
			it('replaces log in cache with detailed log from persistence ', async () => {
				// arrange
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					//  logs are initialized in cache as overviews, so any random cached log should be an overview
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});
				
				// act
				void await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog?.entityId!));

				// assert
				const updatedLog = logService['cache'].value.find(entry => entry.userId === randomUserId)?.logs.find(log => log.entityId === randomLogId);
				expect(updatedLog).toBe(detailedLog);
			});

			it('updates cache subcribers when replacing log from persistence ', async () => {
				// arrange
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					// logs are initialized in cache as overviews, so any random cached log should be an overview
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});
				
				// act
				void await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog?.entityId!));

				// assert
				const updatedCache$ = logService['cache'].asObservable();
				const updatedCache = await firstValueFrom(updatedCache$);
				const updatedLog = updatedCache.find(entry => entry.userId === randomUserId)?.logs.find(log => log.entityId === randomLogId);
				expect(updatedLog).toBe(detailedLog);
			});
			
			it('throws UnauthorizedAccessError submitted user id does not match user context decoded from access token', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserId = new EntityIdDTO(otherUser.userId);

				// act/assert
				expect(async () => logService.fetchLog(userContext, otherUserId, randomLogIdDTO)).rejects.toThrow(UnauthorizedAccessError);
			});
			
			it('throws NotFoundError if no log is found matching provided log entity id', async () => {
				// arrange
				// act/assert
				expect(async () => await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO('no-such-log'))).rejects.toThrow(NotFoundError);
			});			
		
			it('throws UnauthorizedAccessError if log is found but user is not authorized to access it', async () => {
				// arrange
				userContext.roles = ['user'];
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserLogs = await logService.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);
				
				// act/assert
				expect(() => logService.fetchLog(userContext, randomUserIdDTO, randomOtherUserLogId)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws PersistenceError if retrieving detailed log from persistence fails', async () => {
				// arrange
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					// console.debug('fetchById mock called'); this gets called, despite toHaveBeenCalled() failing
					return Promise.resolve(Result.fail<Observable<ConditioningLog<any, ConditioningLogDTO>>>('test error'))
				});

				// act/assert
					// tried, failed to verify that repoSpy is called using .toHaveBeenCalled()
				expect(async () => await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!))).rejects.toThrow(PersistenceError);
			});

			it('throws NotFoundError if no log matching entity id is found in persistence', async () => {
				// arrange
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.ok<any>(of(undefined)));
				});

				// act/assert
				expect(async () => await logService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!))).rejects.toThrow(NotFoundError);
			});

			// TODO: Test default sorting of returned logs
		});

		describe('fetchLogs', () => {
			let allCachedLogs: ConditioningLog<any, ConditioningLogDTO>[];
			let queryDTO: QueryDTO;
			let queryDTOProps: QueryDTOProps;
			let userIdDTO: EntityIdDTO;
			beforeEach(() => {
				allCachedLogs = [...logService['cache'].value]
					.flatMap(entry => entry.logs)				
					.sort((a: any, b: any) => a.start.getTime() - b.start.getTime()); // ascending
				const earliestStart = allCachedLogs[0].start;
				
				allCachedLogs.sort((a: any, b: any) => a.end.getTime() - b.end.getTime()); // ascending
				const latestEnd = allCachedLogs[allCachedLogs.length - 1].end;
				
				queryDTOProps = {
					start: earliestStart!.toISOString(),
					end: latestEnd!.toISOString(),
					activity: ActivityType.MTB,
					userId: userContext.userId as unknown as string,
					sortBy: 'duration',
					order: 'ASC',
					//page: 1, // paging not yet implemented
					//pageSize: 10,
				};
				queryDTO = new QueryDTO(queryDTOProps);

				userIdDTO = new EntityIdDTO(userContext.userId);
			});

			it('gives normal users access to a collection of all their conditioning logs', async () => {
				// arrange
				// act
				const matches = await logService.fetchLogs(userContext, userIdDTO);
				
				// assert
				expect(matches).toBeDefined();
				expect(matches).toBeInstanceOf(Array);
				expect(matches.length).toBe(logsForRandomUser.length);
			});

			it('optionally gives normal users access to their logs matching a query', async () => {
				// arrange
				const queryDtoClone = new QueryDTO(queryDTOProps);
				queryDtoClone.userId = undefined; // logs don't have userId, so this should be ignored
				const query = queryMapper.toDomain(queryDtoClone); // mapper excludes undefined properties
				const expectedLogs = query.execute(logsForRandomUser);
				
				// act
				const matches = await logService.fetchLogs(userContext, userIdDTO, queryDTO);
				
				// assert
				expect(matches).toBeDefined();
				expect(matches).toBeInstanceOf(Array);
				expect(matches.length).toBe(expectedLogs.length);
			});

			it('by default excludes soft deleted logs', async () => {
				// arrange
				randomLog['_updatedOn'] = undefined;
				randomLog.deletedOn = new Date(randomLog.createdOn!.getTime() + 1000);
				const expectedLogs = logsForRandomUser.filter(log => log.deletedOn === undefined);

				// act
				const matches = await logService.fetchLogs(userContext, userIdDTO);
				
				// assert
				expect(matches).toBeDefined();
				expect(matches).toBeInstanceOf(Array);
				expect(matches.length).toBe(logsForRandomUser.length - 1);
				expect(matches.length).toBe(expectedLogs.length);
				expect(matches).not.toContainEqual(randomLog);
				expect(matches).toEqual(expect.arrayContaining(expectedLogs));
			});

			it('optionally can include soft deleted logs', async () => {
				// arrange
				randomLog['_updatedOn'] = undefined;
				randomLog.deletedOn = new Date(randomLog.createdOn!.getTime() + 1000);
				const expectedLogs = logsForRandomUser;
				
				// act
				const matches = await logService.fetchLogs(userContext, userIdDTO, undefined, true);
				
				// assert
				expect(matches).toBeDefined();
				expect(matches).toBeInstanceOf(Array);
				expect(matches.length).toBe(logsForRandomUser.length);
				expect(matches).toEqual(expect.arrayContaining(expectedLogs));
				const deletedLog  = matches.find(log => log.deletedOn !== undefined);
				expect(deletedLog).toBeDefined();
				expect(deletedLog).toEqual(randomLog);
			});

			it('throws UnauthorizedAccessError if normal user tries to access logs for another user', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				queryDTO.userId = otherUser.userId as unknown as string;
				
				// act/assert
				expect(async () => await logService.fetchLogs(userContext, userIdDTO, queryDTO)).rejects.toThrow(UnauthorizedAccessError);
			});
			
			it('gives admin users access to all logs for all users', async () => {
				// arrange
				userContext.roles = ['admin'];
				
				// act
				const allLogs = await logService.fetchLogs(userContext, userIdDTO);
							
				// assert
				expect(allLogs).toBeDefined();
				expect(allLogs).toBeInstanceOf(Array);
				expect(allLogs.length).toBe(testDTOs.length);
			});

			it('optionally gives admin users access to all logs matching a query', async () => {
				// arrange
				userContext.roles = ['admin'];
				
				const queryDtoClone = new QueryDTO(queryDTOProps);
				queryDtoClone.userId = undefined; // logs don't have userId, so this should be ignored
				const query = queryMapper.toDomain(queryDtoClone); // mapper excludes undefined properties
				const expectedLogs = query.execute(allCachedLogs); // get matching logs from test data			
							
				// act
				const allLogs = await logService.fetchLogs(userContext, userIdDTO, queryDTO);
				
				// assert
				expect(allLogs).toBeDefined();
				expect(allLogs).toBeInstanceOf(Array);
				expect(allLogs.length).toBe(expectedLogs.length);
			});
			
			it('by default sorts logs ascending by start date and time, if available', async () => {
				// arrange
				userContext.roles = ['admin'];
				
				// act
				const allLogs = await logService.fetchLogs(userContext, userIdDTO);
				
				// implicitly returns undefined if data is empty
				allLogs?.forEach((log, index) => {
					if (index > 0) {
						const previousLog = allLogs[index - 1];
						if (log.start && previousLog.start) {
							expect(log.start.getTime()).toBeGreaterThanOrEqual(previousLog.start.getTime());
						}
					}
				});
			});

			describe('each log', () => {
				// just test a random log:
				// until we have a mock of import service with mock data,
				// going through all logs is too time consuming,
				// and should be unnecessary
				it('is an instance of ConditioningLog', async () => {
					expect(randomLog).toBeDefined();
					expect(typeof randomLog).toBe('object');
					expect(randomLog).toBeInstanceOf(ConditioningLog);				
				});
				
				it('defaults to an overview', async () => {
					expect(randomLog.isOverview).toBeDefined();
					expect(randomLog.isOverview).toBe(true);
				});
			});
		});

		describe('getCacheSnapshot', () => {
			it('can provide a domain event handler with a snapshot of the cache', async () => {
				// arrange
				const expectedCache = logService['cache'].value;
				const handler = new ConditioningLogCreatedHandler(logRepo, logger);
				
				// act
				const snapshot = logService.getCacheSnapshot(handler);
				
				// assert
				expect(snapshot).toBeDefined();
				expect(snapshot).toEqual(expectedCache);
			});

			it('throws an UnauthorizedAccessError if caller is not an instance of a domain event handler', async () => {
				// arrange
				const caller = { name: 'test' };
				
				// act/assert
				expect(() => logService.getCacheSnapshot(caller as any)).toThrow(UnauthorizedAccessError);				
			});

			
		});
		
		describe('updateCache', () => {
			it('can update the cache with a new snapshot', async () => {
				// arrange
				const newCache = [...logService['cache'].value];
				const handler = new ConditioningLogCreatedHandler(logRepo, logger);
				
				// act
				logService.updateCache(newCache, handler);
				
				// assert
				const newSnapshot = logService.getCacheSnapshot(handler);
				expect(newSnapshot).toEqual(newCache);
			});

			it('throws an UnauthorizedAccessError if caller is not an instance of a domain event handler', async () => {
				// arrange
				const caller = { name: 'test' };
				
				// act/assert
				expect(() => logService.updateCache([], caller as any)).toThrow(UnauthorizedAccessError);				
			});
		});
		
		describe('updateLog', () => {
			let updatedLog: ConditioningLog<any, ConditioningLogDTO>;
			let updatedLogDTO: ConditioningLogDTO;
			let logRepoUpdateSpy: any;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				updatedLogDTO = {...randomLog!.toJSON()};
				updatedLogDTO.activity = ActivityType.RUN;
				updatedLogDTO.duration = {unit: 'ms', value: 100 }; // 100 ms
				updatedLog = ConditioningLog.create(updatedLogDTO, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				logRepoUpdateSpy = jest.spyOn(logRepo, 'update').mockImplementation(() => {
					return Promise.resolve(Result.ok<ConditioningLog<any, ConditioningLogDTO>>(updatedLog))
				});

				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(updatedLog)))
				});

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
			});

			afterEach(() => {
				logRepoUpdateSpy && logRepoUpdateSpy.mockRestore();
				userRepoUpdateSpy && userRepoUpdateSpy.mockRestore();
				jest.clearAllMocks();
			});

			it('updates a conditioning log with new data and persists it in log repo', async () => {
				// arrange
				const updatedLogDTO = {...randomLog!.toJSON()};
				updatedLogDTO.activity = ActivityType.RUN;
				updatedLogDTO.duration = {unit: 'ms', value: 1}; // 1 ms

				// act
				void await logService.updateLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!), updatedLogDTO);

				// assert
				expect(logRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(logRepoUpdateSpy).toHaveBeenCalledWith(updatedLogDTO);
			});

			it('replaces log in cache with updated log following log repo update', async () => {
				// arrange
				logService.updateLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!), updatedLogDTO).then(() => {
					const updateEvent = new ConditioningLogUpdatedEvent({
						eventId: uuidv4(),
						eventName: ConditioningLogUpdatedEvent.name,
						occurredOn: (new Date()).toISOString(),
						payload: updatedLog.toJSON(),
					});
					
					// act
					logRepoUpdatesSubject.next(updateEvent); // simulate event from userRepo.updates$
				
					// assert
					let callCounter = 0;
					const sub = logService['cache'].subscribe(updatedCache => {
						callCounter++;						
						if (callCounter > 1) { // wait for event handler to complete
							const cacheEntry = updatedCache?.find(entry => entry.userId === randomUserId);
							const updatedCacheLog = cacheEntry?.logs.find(log => log.entityId === randomLog!.entityId);
							expect(updatedCacheLog).toBe(updatedLog);
							sub.unsubscribe();
						}
					});
				});
			});

			// TODO: Add failure scenarios
		});

		describe('deleteLog', () => {
			let logRepoDeleteSpy: any;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.ok<void>());
				});

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
			});

			afterEach(() => {
				logRepoDeleteSpy?.mockRestore();
				userRepoUpdateSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('deletes a conditioning log and removes it from log repo', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await logService.deleteLog(userContext, randomUserIdDTO, logIdDTO);

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(logIdDTO.value, true); // true: soft delete is default
			});

			it('by default soft deletes log', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await logService.deleteLog(userContext, randomUserIdDTO, logIdDTO);

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(logIdDTO.value, true); // true: soft delete is default
			});

			it('optionally can hard delete log', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await logService.deleteLog(userContext, randomUserIdDTO, logIdDTO, false); // hard delete

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(logIdDTO.value, false);
			});

			it('removes hard deleted log from user and persists user changes in user repo', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await logService.deleteLog(userContext, randomUserIdDTO, logIdDTO, false); // hard delete

				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(randomUser.toJSON());
			});

			it('removes deleted log from cache following user repo update', async () => {
				// arrange
				const deletedLogId = randomLog!.entityId!;
				const deletedLogIdDTO = new EntityIdDTO(deletedLogId);

				expect(randomUser.logs).toContain(deletedLogId); // sanity check

				logService.deleteLog(userContext, randomUserIdDTO, deletedLogIdDTO).then(() => {
					const deleteEvent = new UserUpdatedEvent({
						eventId: uuidv4(),
						eventName: 'UserUpdatedEvent',
						occurredOn: (new Date()).toISOString(),
						payload: randomUser.toJSON(),
					});
					
					// act
					userRepoUpdatesSubject.next(deleteEvent); // simulate event from userRepo.updates$
				
					// assert
					let callCounter = 0;
					const sub = logService['cache'].subscribe(updatedCache => {
						callCounter++;						
						if (callCounter > 1) { // wait for event handler to complete
							expect(randomUser.logs).not.toContain(deletedLogId);
							const cacheEntry = updatedCache?.find(entry => entry.userId === randomUserId);
							const deletedLog = cacheEntry?.logs.find(log => log.entityId === randomLog!.entityId);
							expect(deletedLog).toBeUndefined();
							sub.unsubscribe();
						}
					});
				});
			});

			// TODO: Add failure scenarios
		});

		describe('undeleteLog', () => {
			let logRepoUndeleteSpy: any;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				logRepoUndeleteSpy = jest.spyOn(logRepo, 'undelete').mockImplementation(() => {
					return Promise.resolve(Result.ok<void>());
				});

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
			});

			afterEach(() => {
				logRepoUndeleteSpy?.mockRestore();
				userRepoUpdateSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it(`undeletes a user's own soft deleted conditioning log and persists it in log repo`, async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await logService.undeleteLog(userContext, randomUserIdDTO, logIdDTO);

				// assert
				expect(logRepoUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoUndeleteSpy).toHaveBeenCalledWith(logIdDTO.value);
			});

			it('restores undeleted log in cache following log repo update', async () => {
				// arrange
				const undeletedLogId = randomLog!.entityId!;
				const undeletedLogIdDTO = new EntityIdDTO(undeletedLogId);

				expect(randomUser.logs).toContain(undeletedLogId); // sanity check

				logService.undeleteLog(userContext, randomUserIdDTO, undeletedLogIdDTO).then(() => {
					const undeleteEvent = new UserUpdatedEvent({
						eventId: uuidv4(),
						eventName: 'UserUpdatedEvent',
						occurredOn: (new Date()).toISOString(),
						payload: randomUser.toJSON(),
					});
					
					// act
					logRepoUpdatesSubject.next(undeleteEvent); // simulate event from logRepo.updates$

					// assert
					let callCounter = 0;
					const sub = logService['cache'].subscribe(updatedCache => {
						callCounter++;						
						if (callCounter > 1) { // wait for event handler to complete
							expect(randomUser.logs).toContain(undeletedLogId);
							const cacheEntry = updatedCache?.find(entry => entry.userId === randomUserId);
							const undeletedLog = cacheEntry?.logs.find(log => log.entityId === randomLog!.entityId);
							expect(undeletedLog).toBeDefined();
							expect(undeletedLog?.deletedOn).toBeUndefined();
							sub.unsubscribe();
						}
					});
				});
			});

			it(`succeeds if admin user tries to undelete other user's log`, async () => {
				// arrange
				userContext.roles = ['admin'];
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserIdDTO = new EntityIdDTO(otherUser.userId);
				const otherUserLogs = await logService.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);

				// act/assert
				expect(() => logService.undeleteLog(userContext, otherUserIdDTO, randomOtherUserLogId)).not.toThrow();
			});

			it(`throws UnauthorizedAccessError if non-admin user tries to undelete other user's log`, async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserIdDTO = new EntityIdDTO(otherUser.userId);
				const otherUserLogs = await logService.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);
				
				// act/assert
				expect(() => logService.undeleteLog(userContext, otherUserIdDTO, randomOtherUserLogId)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws NotFoundError if no log is found in persistence layer matching provided log entity id', async () => {
				// arrange
				logRepoFetchByIdSpy.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.fail<void>('test error')) as any;
				});

				let error: Error | undefined;

				// act/assert
				try { // cannot get jest to catch the error, so using try/catch
					await logService.undeleteLog(userContext, randomUserIdDTO, new EntityIdDTO('no-such-log'));
				}
				catch (e) {
					error = e;
					expect(e).toBeInstanceOf(NotFoundError);
				}
				expect(error).toBeDefined();
				
				// clean up
				logRepoFetchByIdSpy?.mockRestore();
			});

			it('throws PersistenceError if undeleting log in log repo fails', async () => {
				// arrange
				logRepoUndeleteSpy.mockRestore();
				logRepoUndeleteSpy = jest.spyOn(logRepo, 'undelete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});

				// act/assert
				expect(async () => await logService.undeleteLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!))).rejects.toThrow(PersistenceError);
			});
		});
	});

	describe('Protected Methods', () => {
		describe('toConditioningLogSeries', () => {
			let userIdDTO: EntityIdDTO;
			beforeEach(() => {
				userIdDTO = new EntityIdDTO(userContext.userId);
			});

			it('can convert an array of ConditioningLogs to a ConditioningLogSeries', async () => {
				// arrange
				const logs = await logService.fetchLogs(userContext, userIdDTO);
				
				// act
				const series = logService['toConditioningLogSeries'](logs);
				
				// assert
				expect(series).toBeDefined();
				expect(series.unit).toBe('ConditioningLog');
				expect(series.start).toBe(logs[0].start);
				expect(series.data).toBeDefined();
				expect(Array.isArray(series.data)).toBe(true);
				expect(series.data.length).toBe(logs.length);
				series.data.forEach((dataPoint: any, index: number) => {
					expect(dataPoint.timeStamp).toBe(logs[index].start);
					expect(dataPoint.value).toBe(logs[index]);
				});
			});
			
			it('sorts logs by start date', async () => {
				// arrange
				const logs = await logService.fetchLogs(userContext, userIdDTO);
				const unSortedLogs = logs.sort((a, b) => b.start!.getTime() - a.start!.getTime());
				
				// act
				const series = logService['toConditioningLogSeries'](logs);

				// assert
				expect(series.data.length).toBe(logs.length);
				// compare start of each log to previous log; should be ascending
				series.data.forEach((dataPoint: any, index: number) => {
					if (index > 0) {
						expect((dataPoint.timeStamp as Date).getTime()).toBeGreaterThanOrEqual((series.data[index - 1].timeStamp as Date).getTime());
					}
				});
			});

			it('excludes logs without start date', async () => {
				// arrange
				const logs = await logService.fetchLogs(userContext, userIdDTO);
				logDTO.start = undefined;
				const logWithoutStart = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logs.push(logWithoutStart);
				
				// act
				const series = logService['toConditioningLogSeries'](logs);

				// assert
				expect(series.data.length).toBe(logs.length - 1);
			});

			it('logs entity id of logs without start date', async () => {
				// arrange
				const logs = await logService.fetchLogs(userContext, userIdDTO);
				logDTO.start = undefined;
				const logWithoutStart = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logs.push(logWithoutStart);
				const warnSpy = jest.spyOn(logService['logger'], 'warn').mockImplementation(() => { }); // do nothing
				
				// act
				const series = logService['toConditioningLogSeries'](logs);

				// assert
				expect(warnSpy).toHaveBeenCalled();
				expect(warnSpy).toHaveBeenCalledWith(`${logService.constructor.name}: Conditioning log ${logWithoutStart.entityId} has no start date, excluding from ConditioningLogSeries.`);
				warnSpy.mockRestore();
			});			
		});
	});
});