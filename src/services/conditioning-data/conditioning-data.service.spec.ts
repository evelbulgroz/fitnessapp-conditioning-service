import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createTestingModule } from '../../test/test-utils';

import { jest } from '@jest/globals';

import { firstValueFrom, Observable, of, Subject, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { ActivityType, DeviceType, SensorType } from '@evelbulgroz/fitnessapp-base';
import { AggregationType, SampleRate } from '@evelbulgroz/time-series';
import { ConsoleLogger, EntityId, Logger, Result, EntityUpdatedEvent, Entity } from '@evelbulgroz/ddd-base';
import { Query } from '@evelbulgroz/query-fns';

import { AggregationQueryDTO } from '../../dtos/sanitization/aggregation-query.dto';
import { AggregatorService } from '../../services/aggregator/aggregator.service';
import { ConditioningDataService } from './conditioning-data.service';
import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../../repositories/conditioning-log.repo';
import { EntityIdDTO } from '../../dtos/sanitization/entity-id.dto';
import { FileService } from '../file-service/file.service';
import { NotFoundError } from '../../domain/not-found.error';
import { PersistenceError } from '../../domain/persistence.error';
import { QueryDTO } from '../../dtos/sanitization/query.dto';
import { QueryDTOProps } from '../../test/models/query-dto.props';
import { QueryMapper } from '../../mappers/query.mapper';
import { UnauthorizedAccessError } from '../../domain/unauthorized-access.error';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../domain/user-context.model';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user-repo.model';

const originalTimeout = 5000;
//jest.setTimeout(15000);
//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

describe('ConditioningDataService', () => {
	// set up test environment and dependencies/mocks, and initialize the module
	let aggregatorService: AggregatorService;
	let app: TestingModule;
	let dataService: ConditioningDataService;
	let logRepo: ConditioningLogRepo<any, ConditioningLogDTO>;
	let queryMapper: QueryMapper<Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>, QueryDTO>;
	let userRepo: UserRepository<any, UserDTO>;
	let updatesSubject: Subject<any>;
	beforeEach(async () => {
		updatesSubject = new Subject<any>();
		
		app = await createTestingModule({
			imports: [
				//ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				{
					provide: AggregatorService,
					useValue: {
						aggregate: jest.fn()
					}
				},
				ConfigService,
				FileService,
				ConditioningDataService,
				{
					provide: ConditioningLogRepo,
					useValue: {
						create: jest.fn(),
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
						update$: jest.fn(),
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
						updates$: updatesSubject.asObservable(),
					}
				}
			],
		});
		aggregatorService = app.get<AggregatorService>(AggregatorService);
		dataService = app.get<ConditioningDataService>(ConditioningDataService);
		logRepo = app.get<ConditioningLogRepo<any, ConditioningLogDTO>>(ConditioningLogRepo);
		queryMapper = app.get<QueryMapper<Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>, QueryDTO>>(QueryMapper);
		userRepo = app.get<UserRepository<any, UserDTO>>(UserRepository);
	});
	
	// set up test data and spies		
	let logDTO: ConditioningLogDTO;
	let logFetchAllSpy: any;
	const subs: Subscription[] = [];
	let testDTOs: ConditioningLogDTO[];
	let userFetchAllSpy: any;	
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
				start: "2020-08-16T07:03:29.000Z",
				end: "2020-08-16T07:04:49.000Z",
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
				start: "2020-12-06T07:03:29.000Z",
				end: "2020-12-06T07:04:49.000Z",
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
				start: "2020-12-06T07:03:29.000Z",
				end: "2020-12-06T09:04:49.000Z",
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

		logFetchAllSpy = jest.spyOn(logRepo, 'fetchAll')
			.mockImplementation(() => {
				return Promise.resolve(
					Result.ok(of(testDTOs
						.map(dto => ConditioningLog.create(dto, dto.entityId, undefined, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>)))
				);
			});

		const logIds = testDTOs.map(dto => dto.entityId);
		const middleIndex = Math.floor(logIds.length / 2);
		const firstHalfOfLogIds = logIds.slice(0, middleIndex);
		const secondHalfOfLogIds = logIds.slice(middleIndex);

		userFetchAllSpy = jest.spyOn(userRepo, 'fetchAll').mockImplementation(() => Promise.resolve(Result.ok(of([
			User.create(
				<UserDTO>{
					entityId: uuidv4(),
					userId: 'testuser1', // id in user microservice, usually a uuid
					logs: firstHalfOfLogIds,
				},
				uuidv4()
			).value as User,
			User.create(
				<UserDTO>{
					entityId: uuidv4(),
					userId: 'testuser2', // id in user microservice, usually a uuid
					logs: secondHalfOfLogIds,
				},
				uuidv4()
			).value as User
		]))));
	});

	// set up random test data
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
		void await dataService.isReady();			
		
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

		
		logsForRandomUser = dataService['userLogsSubject'].value.find(entry => entry.userId === randomUserId)?.logs || [];
		randomLog = logsForRandomUser[Math.floor(Math.random() * logsForRandomUser.length)] as ConditioningLog<any, ConditioningLogDTO>;
		randomLogIdDTO = new EntityIdDTO(randomLog.entityId!);
	});	

	// tear down test environment
	afterEach(async () => {
		logFetchAllSpy && logFetchAllSpy.mockRestore();
		subs.forEach(sub => sub?.unsubscribe());
		userFetchAllSpy && userFetchAllSpy.mockRestore();
		jest.clearAllMocks();
		jest.setTimeout(originalTimeout);
		await app.close(); // close the module to trigger onModuleDestroy()
	});

	it('can be created', () => {
		expect(dataService).toBeTruthy();
	});

	describe('Initialization', () => {
		it('reports if/when it is initialized (i.e. ready)', async () => {
			// arrange
			dataService['userLogsSubject'].next([]); // force re-initialization
			expect(dataService['userLogsSubject']).toBeDefined(); // sanity checks
			expect(dataService['userLogsSubject'].value.length).toBe(0);

			// act
			const isReady = await dataService.isReady();

			// assert
			expect(isReady).toBe(true);
			expect(dataService['userLogsSubject'].value.length).toBeGreaterThan(0);
		});

		it('populates cache with conditioning logs grouped by user id', async () => {
			// arrange
			const expectedIds = users.map(user => user.userId);
			
			// act
			await dataService.isReady();
			const cache = dataService['userLogsSubject'].value;
			const cachedIds = cache.map(entry => entry.userId);
			
			// assert
			expect(cache.length).toBe(expectedIds.length);
			expect(cachedIds).toEqual(expect.arrayContaining(expectedIds));
		});

		it('can be initialized multiple times without side effects', async () => {
			// arrange
			expect(dataService['userLogsSubject']).toBeDefined(); // sanity checks			
			expect(dataService['userLogsSubject'].value.length).toBe(users.length)
			const expectedLength = dataService['userLogsSubject'].value.length;
			const expectedIds = users.map(user => user.userId);

			// act			
			await dataService.isReady();
			await dataService.isReady();
			await dataService.isReady();
			const cachedIds = dataService['userLogsSubject'].value.map(entry => entry.userId);

			// assert
			expect(dataService['userLogsSubject'].value.length).toBe(expectedLength);
			expect(cachedIds).toEqual(expect.arrayContaining(expectedIds));
		});
	});

	describe('ConditioningData', () => {
		it('can provide a collection of ConditioningDataSeries for all users', async () => {
			// act
			const data = await dataService.conditioningData();
			
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
			const data = await dataService.conditioningData(randomUserId);
			
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
				const data = await dataService.conditioningData(randomUserId);
				expect(typeof data.dataseries[0].activityId).toBe('number');
			});

			it('has a series label', async () => {
				const data = await dataService.conditioningData(randomUserId);
				expect(typeof data.dataseries[0].label).toBe('string');
			});

			it('has a measurement unit', async () => {
				const data = await dataService.conditioningData(randomUserId);
				expect(typeof data.dataseries[0].unit).toBe('string');
			});

			it('has a collection of data points', async () => {
				const data = await dataService.conditioningData(randomUserId);
				expect(data.dataseries[0].data).toBeDefined();
				expect(Array.isArray(data.dataseries[0].data)).toBe(true);
			});
	
			describe('each data point', () => {
				it('has a time stamp that is either a number or a Date', async () => {
					const data = await dataService.conditioningData(randomUserId);
					const timeStamp = data.dataseries[0].data[0].timeStamp;
					expect(typeof timeStamp === 'number' || timeStamp.constructor.name === 'Date').toBe(true);
				});

				it('has a value that is a number', async () => {
					const data = await dataService.conditioningData(randomUserId);
					const value = data.dataseries[0].data[0].value;
					expect(typeof value).toBe('number');
				});
			});			
		});
	});

	describe('ConditioningLogs', () => {
		let allCachedLogs: ConditioningLog<any, ConditioningLogDTO>[];
		let queryDTO: QueryDTO;
		let queryDTOProps: QueryDTOProps;
		let userIdDTO: EntityIdDTO;
		beforeEach(() => {
			allCachedLogs = [...dataService['userLogsSubject'].value]
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
			const matches = await dataService.fetchLogs(userContext, userIdDTO);
			
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
			const matches = await dataService.fetchLogs(userContext, userIdDTO, queryDTO);
			
			// assert
			expect(matches).toBeDefined();
			expect(matches).toBeInstanceOf(Array);
			expect(matches.length).toBe(expectedLogs.length);
		});

		it('throws UnauthorizedAccessError if normal user tries to access logs for another user', async () => {
			// arrange
			const otherUser = users.find(user => user.userId !== userContext.userId)!;
			queryDTO.userId = otherUser.userId as unknown as string;
			
			// act/assert
			expect(async () => await dataService.fetchLogs(userContext, userIdDTO, queryDTO)).rejects.toThrow(UnauthorizedAccessError);
		});
		
		it('gives admin users access to all logs for all users', async () => {
			// arrange
			userContext.roles = ['admin'];
			
			// act
			const allLogs = await dataService.fetchLogs(userContext, userIdDTO);
						
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
			const allLogs = await dataService.fetchLogs(userContext, userIdDTO, queryDTO);
			
			// assert
			expect(allLogs).toBeDefined();
			expect(allLogs).toBeInstanceOf(Array);
			expect(allLogs.length).toBe(expectedLogs.length);
		});
		
		it('by default sorts logs ascending by start date and time, if available', async () => {
			// arrange
			userContext.roles = ['admin'];
			
			// act
			const allLogs = await dataService.fetchLogs(userContext, userIdDTO);
			
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

	describe('Single ConditioningLog', () => {
		// no need to test all logs, just a random one
		// no need to test all detailed properties, rely on unit tests for isOverview property of ConditioningLog class
		let logRepoFetchByidSpy: any
		let userRepoFetchByidSpy: any;
		beforeEach(async () => {
			//const newDetailedLog = ConditioningLog.create(logDTO, randomLog?.entityId, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
			logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async (id: EntityId) => { // return randomLog instead?
				const retrievedLog = ConditioningLog.create(logDTO, id ?? randomLog?.entityId, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(retrievedLog)));
			});
			
			userRepoFetchByidSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() =>
				Promise.resolve(Result.ok(of(randomUser)))
			);
		});

		afterEach(() => {
			logRepoFetchByidSpy && logRepoFetchByidSpy.mockRestore();
		});

		describe('create', () => {
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
				newLog = ConditioningLog.create(newLogDTO, newLogId, undefined, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logRepoCreateSpy = jest.spyOn(logRepo, 'create').mockImplementation(() => {
					return Promise.resolve(Result.ok<ConditioningLog<any, ConditioningLogDTO>>(newLog!))
				});

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
			});

			afterEach(() => {
				logRepoCreateSpy && logRepoCreateSpy.mockRestore();
				userRepoUpdateSpy && userRepoUpdateSpy.mockRestore();
				jest.clearAllMocks();
			});

			it('creates a new log from a DTO and assigns it a unique id', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				const returnedLogId = await dataService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(typeof returnedLogId).toBe('string');
				expect(existingUserLogIds).not.toContain(returnedLogId);
			});

			it('persists new log in repo', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				void await dataService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(logRepoCreateSpy).toHaveBeenCalledTimes(1);
				expect(logRepoCreateSpy).toHaveBeenCalledWith(newLogDTO);
			});

			it('adds new log to user and persists user changes in repo', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				void await dataService.createLog(userContext, randomUserIdDTO, newLogDTO);
				
				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(randomUser.toJSON());
			});

			it('updates cache with new log from repo update', (done) => {
				// arrange
				dataService.createLog(userContext, randomUserIdDTO, newLogDTO).then((newLogId) => {
					const updateEvent = new EntityUpdatedEvent<any, any>({
						eventId: uuidv4(),
						eventName: 'EntityUpdatedEvent',
						occurredOn: new Date(),
						payload: randomUser.toJSON(),
					});
					
					// act
					updatesSubject.next(updateEvent); // simulate event from userRepo.updates$
				
					// assert
					let callCounter = 0;
					const sub = dataService['userLogsSubject'].subscribe(updatedCache => {
						callCounter++;						
						if (callCounter > 1) { // ignore first call
							const cacheEntry = updatedCache?.find(entry => entry.userId === randomUserId);
							const addedLog = cacheEntry?.logs.find(log => log.entityId === newLogId);
							expect(addedLog).toBeDefined();
							sub.unsubscribe();
							done();
						}
					});
				});
			});
		});

		describe('retrieve', () => {
			it('provides details for a conditioning log owned by a user', async () => {
				// arrange
				
				//act
				const detailedLog = await dataService.fetchLog(userContext, randomUserIdDTO, randomLogIdDTO);

				// assert
				expect(detailedLog!).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.isOverview).toBe(false);
			});
						
			it(`can provide a details for other user's conditioning log if user role is 'admin'`, async () => {
				// arrange
				userContext.roles = ['admin'];
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserLogs = await dataService.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				
				//act
				const detailedLog = await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomOtherUserLog!.entityId!));

				// assert
				expect(detailedLog!).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.isOverview).toBe(false);
			});

			it('throws UnauthorizedAccessError submitted user id does not match user context decoded from access token', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserId = new EntityIdDTO(otherUser.userId);

				// act/assert
				expect(async () => dataService.fetchLog(userContext, otherUserId, randomLogIdDTO)).rejects.toThrow(UnauthorizedAccessError);
			});
			
			it('throws NotFoundError if no log is found matching provided log entity id', async () => {
				// arrange
				// act/assert
				expect(async () => await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO('no-such-log'))).rejects.toThrow(NotFoundError);
			});			
		
			it('throws UnauthorizedAccessError if log is found but user is not authorized to access it', async () => {
				// arrange
				userContext.roles = ['user'];
				const otherUser = users.find(user => user.userId !== userContext.userId)!;
				const otherUserLogs = await dataService.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);
				
				// act/assert
				expect(() => dataService.fetchLog(userContext, randomUserIdDTO, randomOtherUserLogId)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('returns log directly from cache if already detailed', async () => {
				// arrange
					// reset spy to avoid side effects
				logRepoFetchByidSpy.mockRestore();
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById'); // should not be called
				
					// replace random log in cache with detailed log
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, randomLogId, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				const cache = dataService['userLogsSubject'].value;
				const cacheEntry = cache.find(entry => entry.userId === randomUserId);
				const logIndex = cacheEntry!.logs.findIndex(log => log.entityId === randomLogId);
				cacheEntry!.logs[logIndex] = detailedLog;				
				
				//act
				const retrievedLog = await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!));

				// assert
				expect(retrievedLog?.entityId).toBe(randomLog?.entityId);
				expect(retrievedLog?.isOverview).toBe(false);
				expect(retrievedLog).toBe(detailedLog);

				expect(logRepoFetchByidSpy).not.toHaveBeenCalled(); // may/not be reliable, but should be true
			});

			it('retrieves detailed log from persistence if cached log is overview', async () => {
				// arrange
				logRepoFetchByidSpy.mockRestore();
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					//  logs are initialized in cache as overviews, so any random cached log should be an overview
					const randomLogId = randomLog!.entityId!;
					const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
					const detailedLog = ConditioningLog.create(dto, randomLogId, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});

				// act
				const retrievedLog = await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!));

				// assert
				expect(retrievedLog?.entityId).toBe(randomLog?.entityId);
				expect(retrievedLog?.isOverview).toBe(false);
			});
			
			it('passes through log from persistence as-is, without checking if details are actually available ', async () => {
				// arrange
					// create a new log with isOverview set to true, and no detailed properties -> should be returned without checking for details
				const detailedLogMock = ConditioningLog.create(logDTO, randomLog?.entityId, undefined, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () =>
					Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLogMock)))
				);
				
				//act
				const retrievedLog = await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!));

				// assert
				expect(retrievedLog?.isOverview).toBe(true);
			});
			
			it('throws PersistenceError if retrieving detailed log from persistence fails', async () => {
				// arrange
				logRepoFetchByidSpy.mockRestore();
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					// console.debug('fetchById mock called'); this gets called, despite toHaveBeenCalled() failing
					return Promise.resolve(Result.fail<Observable<ConditioningLog<any, ConditioningLogDTO>>>('test error'))
				});

				// act/assert
					// tried, failed to verify that repoSpy is called using .toHaveBeenCalled()
				expect(async () => await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!))).rejects.toThrow(PersistenceError);
			});

			it('throws NotFoundError if no log matching entity id is found in persistence', async () => {
				// arrange
				logRepoFetchByidSpy.mockRestore();
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.ok<any>(of(undefined)));
				});

				// act/assert
				expect(async () => await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!))).rejects.toThrow(NotFoundError);
			});
			
			it('replaces log in cache with detailed log from persistence ', async () => {
				// arrange
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, randomLogId, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				logRepoFetchByidSpy.mockRestore();
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					//  logs are initialized in cache as overviews, so any random cached log should be an overview
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});
				
				// act
				void await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog?.entityId!));

				// assert
				const updatedLog = dataService['userLogsSubject'].value.find(entry => entry.userId === randomUserId)?.logs.find(log => log.entityId === randomLogId);
				expect(updatedLog).toBe(detailedLog);
			});

			it('updates cache subcribers when replacing log from persistence ', async () => {
				// arrange
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, randomLogId, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				logRepoFetchByidSpy.mockRestore();
				logRepoFetchByidSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					// logs are initialized in cache as overviews, so any random cached log should be an overview
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});
				
				// act
				void await dataService.fetchLog(userContext, randomUserIdDTO, new EntityIdDTO(randomLog?.entityId!));

				// assert
				const updatedCache$ = dataService['userLogsSubject'].asObservable();
				const updatedCache = await firstValueFrom(updatedCache$);
				const updatedLog = updatedCache.find(entry => entry.userId === randomUserId)?.logs.find(log => log.entityId === randomLogId);
				expect(updatedLog).toBe(detailedLog);
			});

			// TODO: Test default sorting of returned logs
		});			
	});
	
	describe('Aggregation', () => {
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
					return {} as any
				});

			userIdDTO = new EntityIdDTO(userContext.userId);

			await dataService.isReady();
		});
		
		afterEach(() => {
			aggregatorSpy && aggregatorSpy.mockRestore();
		});		
		
		// NOTE:
		// not testing that AggregatorService works, just that it is called with the right parameters
		// leave deeper testing of the result to AggregatorService tests to avoid duplication
		it('can aggregate a time series of all ConditioningLogs owned by a user', async () => {
			// arrange
			const expectedTimeSeries = dataService['toConditioningLogSeries'](await dataService.fetchLogs(userContext, userIdDTO));
			
			// act
			const aggregatedSeries = await dataService.fetchaggretagedLogs(userContext, aggregationQueryDTO, undefined);
			
			// assert
			expect(aggregatorSpy).toHaveBeenCalled();
			expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			expect(aggregatedSeries).toBeDefined();			
		});
		
		it(`can aggregate a time series of all ConditioningLogs for all users if user role is 'admin'`, async () => {
			// arrange
			userContext.roles = ['admin'];

			// act
			const aggregatedSeries = await dataService.fetchaggretagedLogs(userContext, aggregationQueryDTO);
			const expectedTimeSeries = dataService['toConditioningLogSeries'](await dataService.fetchLogs(userContext, userIdDTO));
			
			// assert
			expect(aggregatorSpy).toHaveBeenCalled();
			expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			expect(aggregatedSeries).toBeDefined();
		});
		
		it('aggreates only logs matching query, if provided', async () => {			
			// arrange
			const searchableLogs = dataService['userLogsSubject'].value.find((entry) => entry.userId === userContext.userId)?.logs ?? [];
			const queryDTO = new QueryDTO({'activity': ActivityType.MTB});
			const query = queryMapper.toDomain(queryDTO);
			const matchingLogs = query.execute(searchableLogs);
			const expectedTimeSeries = dataService['toConditioningLogSeries'](matchingLogs);

			// act
			const aggregatedSeries = await dataService.fetchaggretagedLogs(userContext, aggregationQueryDTO, queryDTO);
			
			// assert
			expect(aggregatorSpy).toHaveBeenCalled();
			expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			expect(aggregatedSeries).toBeDefined();
		});

		it('throws UnauthorizedAccessError if user tries to access logs of another user', async () => {
			// arrange
			const queryDTO = new QueryDTO({	userId: 'no-such-user'});
			const otherUser = users.find(user => user.userId !== userContext.userId)!;
			const otherUserContext = new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']});
			
			// act/assert
			expect(async () => await dataService.fetchaggretagedLogs(otherUserContext, aggregationQueryDTO, queryDTO)).rejects.toThrow(UnauthorizedAccessError);
		});
	});

	describe('Utilities', () => {
		describe('Conversion to time series', () => {
			let userIdDTO: EntityIdDTO;
			beforeEach(() => {
				userIdDTO = new EntityIdDTO(userContext.userId);
			});

			it('can convert an array of ConditioningLogs to a ConditioningLogSeries', async () => {
				// arrange
				const logs = await dataService.fetchLogs(userContext, userIdDTO);
				
				// act
				const series = dataService['toConditioningLogSeries'](logs);
				
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
				const logs = await dataService.fetchLogs(userContext, userIdDTO);
				const unSortedLogs = logs.sort((a, b) => b.start!.getTime() - a.start!.getTime());
				
				// act
				const series = dataService['toConditioningLogSeries'](logs);

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
				const logs = await dataService.fetchLogs(userContext, userIdDTO);
				logDTO.start = undefined;
				const logWithoutStart = ConditioningLog.create(logDTO, uuidv4(), undefined, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logs.push(logWithoutStart);
				
				// act
				const series = dataService['toConditioningLogSeries'](logs);

				// assert
				expect(series.data.length).toBe(logs.length - 1);
			});

			it('logs entity id of logs without start date', async () => {
				// arrange
				const logs = await dataService.fetchLogs(userContext, userIdDTO);
				logDTO.start = undefined;
				const logWithoutStart = ConditioningLog.create(logDTO, uuidv4(), undefined, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logs.push(logWithoutStart);
				const warnSpy = jest.spyOn(dataService['logger'], 'warn').mockImplementation(() => { }); // do nothing
				
				// act
				const series = dataService['toConditioningLogSeries'](logs);

				// assert
				expect(warnSpy).toHaveBeenCalled();
				expect(warnSpy).toHaveBeenCalledWith(`${dataService.constructor.name}: Conditioning log ${logWithoutStart.entityId} has no start date, excluding from ConditioningLogSeries.`);
				warnSpy.mockRestore();
			});			
		});
	});
});