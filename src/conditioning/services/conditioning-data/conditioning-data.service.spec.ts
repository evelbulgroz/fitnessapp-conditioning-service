import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';

import { firstValueFrom, Observable, of, Subject, Subscription, take } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';


import { ActivityType, DeviceType, SensorType } from '@evelbulgroz/fitnessapp-base';
import { AggregationType, SampleRate } from '@evelbulgroz/time-series';
import { ComponentState, ComponentStateInfo } from '../../../libraries/managed-stateful-component';
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { Query } from '@evelbulgroz/query-fns';
import { StreamLogger } from '../../../libraries/stream-loggable';

import AggregationQueryDTO from '../../dtos/aggregation-query.dto';
import AggregatorService from '../aggregator/aggregator.service';
import BooleanDTO from '../../../shared/dtos/responses/boolean.dto';
import {
	ConditioningDataService,
	ConditioningLog,
	ConditioningLogDTO,
	ConditioningLogRepository,
	ConditioningLogCreatedHandler,
	ConditioningLogUpdatedHandler,
	ConditioningLogDeletedHandler,
	ConditioningLogUndeletedHandler,
	ConditioningLogUpdatedEvent,
	QueryMapper
} from '../..';
import createTestingModule from '../../../test/test-utils';
import EntityIdDTO from '../../../shared/dtos/responses/entity-id.dto';
import EventDispatcherService from '../../../shared/services/utils/event-dispatcher/event-dispatcher.service';
import NotFoundError from '../../../shared/domain/not-found.error';
import PersistenceError from '../../../shared/domain/persistence.error';
import { QueryDTO, QueryDTOProps } from '../../../shared/dtos/responses/query.dto';
import UnauthorizedAccessError from '../../../shared/domain/unauthorized-access.error';
import { User, UserDTO, UserPersistenceDTO, UserRepository, UserUpdatedEvent, UserCreatedHandler, UserUpdatedHandler, UserDeletedHandler } from '../../../user';
import UserContext from '../../../shared/domain/user-context.model';
import { ShutdownSignal } from '@nestjs/common';
import { request } from 'http';
import { is, ta } from 'date-fns/locale';
import { log } from 'console';

//const originalTimeout = 5000;
//jest.setTimeout(15000);
//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// TODO: Mock more dependencies to isolate the test to only the ConditioningDataService

describe('ConditioningDataService', () => {
	// set up test environment and dependencies/mocks, and initialize the module
	let aggregatorService: AggregatorService;
	let app: TestingModule;
	let service: ConditioningDataService;
	let logRepo: ConditioningLogRepository<any, ConditioningLogDTO>;
	let logRepoUpdatesSubject: Subject<any>;
	let queryMapper: QueryMapper<Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>, QueryDTO>;
	let userRepo: UserRepository;
	let userRepoUpdatesSubject: Subject<any>;
	beforeEach(async () => {
		logRepoUpdatesSubject = new Subject<any>();
		userRepoUpdatesSubject = new Subject<any>();
		
		app = await (await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				{ // AggregatorService
					provide: AggregatorService,
					useValue: {
						aggregate: jest.fn()
					}
				},
				ConfigService,
				EventDispatcherService,				
				{ // ConditioningLogCreatedHandler
					provide: ConditioningLogCreatedHandler,
					useValue: {
						handle: () => Promise.resolve(undefined)
					}
				},
				{ // ConditioningLogUpdatedHandler
					provide: ConditioningLogUpdatedHandler,
					useValue: {
						handle: () => jest.fn()
					}
				},
				{ // ConditioningLogDeletedHandler
					provide: ConditioningLogDeletedHandler,
					useValue: {
						handle: () => Promise.resolve(undefined)
					}
				},
				{ // ConditioningLogUndeletedHandler
					provide: ConditioningLogUndeletedHandler,
					useValue: {
						handle: () => Promise.resolve(undefined)
					}
				},
				{ // UserCreatedHandler
					provide: UserCreatedHandler,
					useValue: {
						handle: () => Promise.resolve(undefined)
					}
				},
				{ // UserUpdatedHandler
					provide: UserUpdatedHandler,
					useValue: {
						handle: () => Promise.resolve(undefined)
					}
				},
				{ // UserDeletedHandler
					provide: UserDeletedHandler,
					useValue: {
						handle: () => Promise.resolve(undefined)
					}
				},
				ConditioningDataService,
				{ // ConditioningLogRepository
					provide: ConditioningLogRepository,
					useValue: {
						create: jest.fn(),
						delete: jest.fn(),
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
						initialize: jest.fn(),
						isReady: jest.fn(),
						shutdown: jest.fn(),
						update: jest.fn(),
						updates$: logRepoUpdatesSubject.asObservable(),
						undelete: jest.fn(),
						logger: {
							log: jest.fn(),
							error: jest.fn(),
							warn: jest.fn(),
							info: jest.fn(),
							debug: jest.fn(),
							verbose: jest.fn(),
						}
					}
				},
				QueryMapper,
				{ // REPOSITORY_THROTTLETIME
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				},
				{ // UserRepository
					provide: UserRepository,
					useValue: {
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
						initialize: jest.fn(),
						isReady: jest.fn(),
						shutdown: jest.fn(),
						update: jest.fn(),
						updates$: userRepoUpdatesSubject.asObservable(),
						undelete: jest.fn(),
						logger: {
							log: jest.fn(),
							error: jest.fn(),
							warn: jest.fn(),
							info: jest.fn(),
							debug: jest.fn(),
							verbose: jest.fn(),
						}
					}
				}
			],
		}))
		.compile();

		aggregatorService = app.get<AggregatorService>(AggregatorService);
		service = app.get<ConditioningDataService>(ConditioningDataService);
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
					Result.ok(
						of(testDTOs.map(dto => ConditioningLog.create(dto, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>))
					)
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

	// set up random test data, initialize dataService
	let adminUserCtx: UserContext;
	let randomLog: ConditioningLog<any, ConditioningLogDTO>;
	let randomUser: User;
	let randomUserId: EntityId;
	let randomUserIdDTO: EntityIdDTO;
	let logsForRandomUser: ConditioningLog<any, ConditioningLogDTO>[];
	let users: User[];
	let normalUserCtx: UserContext;
	beforeEach(async () => {
		// arrange
		void await service.initialize();			
		
		const users$ = (await userRepo.fetchAll()).value as Observable<User[]>;		
		users = await firstValueFrom(users$);
		randomUserId = users[Math.floor(Math.random() * users.length)].userId;
		randomUserIdDTO = new EntityIdDTO(randomUserId);
		randomUser = users.find(user => user.userId === randomUserId)!;

		adminUserCtx = new UserContext({
			userId: randomUser.userId,
			userName: 'admin', // display name for user, or dataService name if user is a dataService account (subName from JWTPayload)
			userType: 'user',
			roles: ['admin']
		});

		normalUserCtx = new UserContext({
			userId: randomUser.userId,
			userName: 'evelbulgroz', // display name for user, or dataService name if user is a dataService account (subName from JWTPayload)
			userType: 'user',
			roles: ['user']
		});
		
		logsForRandomUser = service['cache'].value.find(entry => entry.userId === randomUserId)?.logs || [];
		randomLog = logsForRandomUser[Math.floor(Math.random() * logsForRandomUser.length)] as ConditioningLog<any, ConditioningLogDTO>;
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
		
		//jest.setTimeout(originalTimeout);
		await app.close(); // close the module to trigger onModuleDestroy()
	});

	it('can be created', () => {
		expect(service).toBeTruthy();
	});

	describe('Component Lifecycle', () => {
		it('can be created', () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(ConditioningDataService);
		});

		// NOTE: Mostly just testing that the lifecycle method calls are effectively routed to the base clase by the mixin.

		describe('Initialization', () => {
			it('can be initialized', async () => {
				// arrange
				// act/assert
				expect(async () => await service.initialize()).not.toThrow(); // just check that it doesn't throw
			});

			it('initializes cache with a collection of overview logs', async () => {			
				// arrange
				await service.initialize(); // initialize the repo
				const cache = service['cache'].value;
				expect(cache).toBeDefined();
				expect(Array.isArray(cache)).toBe(true);
				expect(cache.length).toBe(users.length); // one entry for each user in the repo
				cache.forEach(entry => {
					expect(entry.userId).toBeDefined();
					expect(entry.logs).toBeDefined();
					expect(Array.isArray(entry.logs)).toBe(true);
					//expect(entry.logs.length).toBe(2); // todo: use a calculated value to make it more robust against changes to test data
					entry.logs.forEach(log => {
						expect(log).toBeInstanceOf(ConditioningLog);
						const dto = testDTOs.find(dto => dto.entityId === log.entityId);
						expect(dto).toBeDefined();
						expect(log.entityId).toBe(dto!.entityId);
						expect(log.isOverview).toBe(true);
					});
				});
			});
		});

		describe('Shutdown', () => {
			it('can be shut down', async () => {
				// arrange
				await service.initialize(); // initialize the repo
				
				// act/assert
				expect(async () => await service.shutdown()).not.toThrow(); // just check that it doesn't throw
			});

			it('unsubscribes from all observables and clears subscriptions', async () => {
				// arrange
				const dummySubscription = new Observable((subscriber) => {
					subscriber.next('dummy');
					subscriber.complete();
				});
				service['subscriptions'].push(dummySubscription.subscribe());
				expect(service['subscriptions'].length).toBe(3); // sanity check	
				
				await service.initialize(); // initialize the service
				
				// act
				await service.shutdown();

				// assert
				expect(service['subscriptions'].length).toBe(0); // all subscriptions should be cleared
			});
		});	
	});

	describe('Data API', () => {
		let aggregationQueryDTO: AggregationQueryDTO;
		let aggregatorSpy: any;
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

			await service.isReady();
		});
		
		afterEach(() => {
			aggregatorSpy && aggregatorSpy?.mockRestore();
		});

		describe('conditioningData', () => {
			it('can provide a collection of ConditioningDataSeries for all users', async () => {
				// act
				const data = await service.conditioningData();
				
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
				const data = await service.conditioningData(randomUserId);
				
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
					const data = await service.conditioningData(randomUserId);
					expect(typeof data.dataseries[0].activityId).toBe('number');
				});

				it('has a series label', async () => {
					const data = await service.conditioningData(randomUserId);
					expect(typeof data.dataseries[0].label).toBe('string');
				});

				it('has a measurement unit', async () => {
					const data = await service.conditioningData(randomUserId);
					expect(typeof data.dataseries[0].unit).toBe('string');
				});

				it('has a collection of data points', async () => {
					const data = await service.conditioningData(randomUserId);
					expect(data.dataseries[0].data).toBeDefined();
					expect(Array.isArray(data.dataseries[0].data)).toBe(true);
				});
		
				describe('each data point', () => {
					it('has a time stamp that is either a number or a Date', async () => {
						const data = await service.conditioningData(randomUserId);
						const timeStamp = data.dataseries[0].data[0].timeStamp;
						expect(typeof timeStamp === 'number' || timeStamp.constructor.name === 'Date').toBe(true);
					});

					it('has a value that is a number', async () => {
						const data = await service.conditioningData(randomUserId);
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
			let logRepoDeleteSpy: any;
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			let isAdmin: boolean;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				existingUserLogIds = logsForRandomUser.map(log => log.entityId!);
				
				newLogId = uuidv4();				
				newLogDTO = testDTOs[Math.floor(Math.random() * testDTOs.length)];	
				newLogDTO.entityId = newLogId;
				newLog = ConditioningLog.create(newLogDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				
				requestingUserId = normalUserCtx.userId;
				isAdmin = normalUserCtx.roles.includes('admin');
				targetUserId = randomUserId;
				
				logRepoCreateSpy = jest.spyOn(logRepo, 'create').mockImplementation(() => {
					return Promise.resolve(Result.ok<ConditioningLog<any, ConditioningLogDTO>>(newLog!))
				});

				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation((id) => 
					Promise.resolve(Result.ok())
				);

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() => {
					return Promise.resolve(Result.ok(randomUser))
				});
			});

			afterEach(() => {
				logRepoCreateSpy?.mockRestore();
				logRepoDeleteSpy?.mockRestore();
				userRepoUpdateSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('creates a new log in the system and assigns it a unique id', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				const returnedLogId = await service.createLog(
					requestingUserId,
					targetUserId,
					newLog,
					isAdmin,
				);
				
				// assert
				expect(typeof returnedLogId).toBe('string');
				expect(existingUserLogIds).not.toContain(returnedLogId);
			});

			it('persists new log in repo', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				void await service.createLog(
					requestingUserId,
					targetUserId,
					newLog,
					isAdmin,
				);
				
				// assert
				expect(logRepoCreateSpy).toHaveBeenCalledTimes(1);
				expect(logRepoCreateSpy).toHaveBeenCalledWith(newLog);
			});

			it('adds new log to user and persists user changes in repo', async () => {
				// arrange
				expect(randomUser.logs).not.toContain(newLogId); // sanity check
				
				// act
				void await service.createLog(
					requestingUserId,
					targetUserId,
					newLog,
					isAdmin,
				);
				
				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(randomUser.toDTO());
			});

			it('adds new log to cache entry', async () => {
				// NOTE:
				// The cache is only updated in response to an emission from the UserRepository.update$,
				// so we need to simulate that here.
				
				// The process of creating a log and updating the cache follows this sequence:
					// 1. Create log in ConditioningLogRepository
					// 2. Update user in UserRepository
					// 3. Emit UserUpdatedEvent from user repo
					// 4. Dispatch UserUpdatedEvent from conditioning service to event dispatcher
					// 5. Dispatch UserUpdatedEvent to userUpdatedHandler
					// 6. Update cache entry in userUpdatedHandler
					// 7. Return created log id from conditioning service
				
				// Each of these collaborators is tested invididually, so here we just test that
				// they are called in the right order.
				
				// For completeness, we also mock the cache update and verify that the cache entry
				// is updated correctly.

				// NOTE: ConditioningLogCreatedHandler currently does nothing, so we can ignore it here,
				// even though it will be called in the real implementation.

				// arrange	
				let cacheEntry = service['cache'].value.find(entry => entry.userId === randomUserId);
				expect(cacheEntry).toBeDefined();
				expect(cacheEntry!.logs.find(log => log.entityId === newLogId)).not.toBeDefined(); // sanity check
				
				randomUser.addLog(newLogId);
				const updatedUserDTO = randomUser.toDTO();
				
				const event = new UserUpdatedEvent({
					eventId: uuidv4(),
					eventName: UserUpdatedEvent.name,
					occurredOn: new Date().toISOString(),
					payload: updatedUserDTO
				});
				
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() => {				  
					setTimeout(() => userRepoUpdatesSubject.next(event), 10); // Emit the event with short delay to simulate async behavior
					return Promise.resolve(Result.ok(randomUser));
				});
				
				const eventDispatcher = app.get<EventDispatcherService>(EventDispatcherService);
				const eventDispatcherSpy = jest.spyOn(eventDispatcher, 'dispatch');
				
				const userUpdatedHandler = app.get<UserUpdatedHandler>(UserUpdatedHandler);
				const userUpdatedHandleSpy = jest.spyOn(userUpdatedHandler, 'handle').mockImplementation((event: UserUpdatedEvent) => {
					// add the log to the cache entry (simplified version of the real implementation)
					const userCacheEntry = service['cache'].value.find(entry => entry.userId === event.payload.userId);
					if (userCacheEntry) {
						const newLog = ConditioningLog.create(newLogDTO, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
						userCacheEntry.logs.push(newLog); // add the log to the cache entry
					}
					return Promise.resolve(void 0);
				});
				
				let eventEmitted = false;
				const eventPromise = new Promise<void>(resolve => { // resolve the promise when the event is emitted
					const subscription = userRepo.updates$.subscribe(emittedEvent => {
						if (emittedEvent instanceof UserUpdatedEvent) {
							eventEmitted = true;
							subscription.unsubscribe();
							resolve();
						}
					});
				});
				
				// act
				void await service.createLog(
					requestingUserId,
					targetUserId,
					newLog,
					isAdmin,
				);
				// wait for the event to be emitted and handled
				await eventPromise;
				
				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
					entityId: randomUser.entityId,
					logs: expect.arrayContaining([newLogId])
				}));
				
				expect(eventEmitted).toBe(true);
				
				expect(eventDispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({
					eventName: UserUpdatedEvent.name,
					payload: expect.objectContaining({
						logs: expect.arrayContaining([newLogId])
					})
				}));
				
				expect(userUpdatedHandleSpy).toHaveBeenCalledWith(expect.objectContaining({
					eventName: UserUpdatedEvent.name,
					payload: expect.objectContaining({
						logs: expect.arrayContaining([newLogId])
					})
				}));

				cacheEntry = service['cache'].value.find(entry => entry.userId === randomUserId);
				expect(cacheEntry).toBeDefined();
				expect(cacheEntry!.logs.find(log => log.entityId === newLogId)).toBeDefined();				
			});

			it(`succeeds if admin user tries to create a log for another user`, async () => {
				// arrange
				requestingUserId = adminUserCtx.userId; // admin user creates a log for another user
				const otherUser = users.find(user => user.userId !== randomUserId)!;
				targetUserId = otherUser.userId;
				
				// act
				const returnedLogId = await service.createLog(
					requestingUserId, // admin user
					targetUserId, // any other user
					newLog,
					true, // isAdmin
				);
				
				// assert
				expect(typeof returnedLogId).toBe('string');
				expect(existingUserLogIds).not.toContain(returnedLogId);
			});

			it('throws UnauthorizedAccessError if non-admin user tries to create a log for another user', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== randomUserId)!;
				targetUserId = otherUser.userId;
				
				// act/assert
				expect(async () => await service.createLog(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					newLog,
					false, // isAdmin
				)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws NotFoundError if user does not exist in persistence layer', async () => {
				// arrange
				logRepoCreateSpy?.mockRestore();
				logRepoCreateSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => {
					return Promise.resolve(Result.fail(new NotFoundError('Test Error')));
				});
				
				// act/assert
				expect(async () => await service.createLog(
					requestingUserId,
					targetUserId,
					newLog,
					false, // isAdmin
				)).rejects.toThrow(NotFoundError);
			});

			it('throws PersistenceError if log creation fails in persistence layer', async () => {
				// arrange
				logRepoCreateSpy?.mockRestore();
				logRepoCreateSpy = jest.spyOn(logRepo, 'create').mockImplementation(() => {
					return Promise.resolve(Result.fail(new PersistenceError('Test Error')));
				});
				
				// act/assert
				expect(async () => await service.createLog(
					requestingUserId,
					targetUserId,
					newLog,
					false, // isAdmin
				)).rejects.toThrow(PersistenceError);
			});

			it('throws PersistenceError if updating user fails in persistence layer', async () => {
				// NOTE: Details of rollback tested in rollbackLogCreation() tests
				
				// arrange
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() => {
					return Promise.resolve(Result.fail(new PersistenceError('Test Error')));
				});
				let error: Error | undefined;
				
				// act
				// can't get this to work, jest does not catch the error:
				//expect(async () => await logService.createLog(userContext, randomUserIdDTO, newLogDTO)).rejects.toThrow(PersistenceError);
				// so going old school:
				try {
					void await service.createLog(
						requestingUserId,
						targetUserId,
						newLog,
						false, // isAdmin
					);
				}
				catch (e) {
					error = e;
					expect(e).toBeInstanceOf(PersistenceError);
				}

				expect(error).toBeDefined();
				expect(error).toBeInstanceOf(PersistenceError);
				
				// clean up
				userRepoUpdateSpy?.mockRestore();
			});
		});

		describe('fetchActivityCounts', () => {
			// helper function to count activities in logs
			// for now same algo as in dataService, so not much of a test of the algo
			// however, enables basic testing which is fine for now			
			function getActivityCounts(logs: ConditioningLog<any, ConditioningLogDTO>[]): Record<string, number> {
				const activityCounts: Record<string, number> = {};
				logs.forEach((log) => {
					const activity = log.activity;
					activityCounts[activity] ? activityCounts[activity]++ : activityCounts[activity] = 1;
				});
				return activityCounts;
			}

			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			let isAdmin: boolean;
			beforeEach(() => {
				requestingUserId = normalUserCtx.userId;
				targetUserId = randomUserId;
				isAdmin = normalUserCtx.roles.includes('admin');
			});

			it('provides user a count of their own activities', async () => {
				// arrange
				const expectedCounts = getActivityCounts(logsForRandomUser);
				
				// act
				const activityCounts = await service.fetchActivityCounts(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					// no query, isAdmin defaults to false, includeDeleted defaults to false
				);
				
				// assert
				expect(activityCounts).toBeDefined();
				expect(activityCounts).toEqual(expectedCounts);
			});
			
			it('provides admins with a count of activities for a different user by id', async () => {
				// arrange
				requestingUserId = adminUserCtx.userId; // admin user fetches activity counts for another user
				isAdmin = true; // isAdmin is true for admin user
				
				const otherUser = users.find(user => user.userId !== randomUserId)!;
				targetUserId = otherUser.userId;
				
				const logs = service['cache'].value.find(entry => entry.userId === targetUserId)?.logs ?? [];
				
				const expectedCounts = getActivityCounts(logs);
				
				// act
				const activityCounts = await service.fetchActivityCounts(
					requestingUserId, // admin user
					targetUserId, // any other user
					undefined,// no query
					isAdmin
					// no includeDeleted, so defaults to false
				);
				
				// assert
				expect(activityCounts).toBeDefined();
				expect(activityCounts).toEqual(expectedCounts);
			});
			
			it('provides admins with a count of activities for all users', async () => {
				// arrange
				requestingUserId = adminUserCtx.userId; // admin user fetches activity counts for all users
				isAdmin = true; // isAdmin is true for admin user

				const logs = service['cache'].value ?? [];
				const expectedCounts = getActivityCounts(logs.flatMap(entry => entry.logs));
				
				// act
				const activityCounts = await service.fetchActivityCounts(
					requestingUserId, // admin user
					undefined, // no userId, so fetches for all users
					undefined, // no query
					isAdmin // isAdmin is true for admin user
				);
				
				// assert
				expect(activityCounts).toBeDefined();
				expect(activityCounts).toEqual(expectedCounts);
			});
			
			it('optionally filters logs by provided query', async () => {
				// arrange
				const queryDTO = new QueryDTO({'activity': ActivityType.MTB});
				const query = queryMapper.toDomain(queryDTO);
				const matchingLogs = query.execute(logsForRandomUser);
				const expectedCounts = getActivityCounts(matchingLogs);
				
				// act
				const activityCounts = await service.fetchActivityCounts(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					queryDTO, // query to filter logs
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);
				
				// assert
				expect(activityCounts).toBeDefined();
				expect(activityCounts).toEqual(expectedCounts);
				expect(Object.keys(activityCounts)).toEqual([ActivityType.MTB]);
			});

			it('by default excludes activities from soft deleted logs', async () => {
				// arrange
				const deletedLog = logsForRandomUser[0];
				deletedLog['_updatedOn'] = undefined;
				deletedLog.deletedOn = new Date(deletedLog.createdOn!.getTime() + 1000);
				const logs = logsForRandomUser.filter(log => log.deletedOn === undefined);
				const expectedCounts = getActivityCounts(logs);
				
				// act
				const activityCounts = await service.fetchActivityCounts(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					undefined, // no query
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);
				
				// assert
				expect(activityCounts).toBeDefined();
				expect(activityCounts).toEqual(expectedCounts);
			});

			it('optionally can include activities from soft deleted logs', async () => {
				// arrange
				const deletedLog = logsForRandomUser[0];
				deletedLog['_updatedOn'] = undefined;
				deletedLog.deletedOn = new Date(deletedLog.createdOn!.getTime() + 1000);
				const expectedCounts = getActivityCounts(logsForRandomUser);
				
				// act
				const activityCounts = await service.fetchActivityCounts(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					undefined, // no query
					false, // isAdmin
					true // includeDeleted is true
				);
				
				// assert
				expect(activityCounts).toBeDefined();
				expect(activityCounts).toEqual(expectedCounts);
			});
			
			it('throws UnauthorizedAccessError if non-admin user tries to access activities of another user', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== targetUserId)!;
				targetUserId = otherUser.userId;
				
				// act/assert
				expect(async () => await service.fetchActivityCounts(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					// using default values for query, isAdmin and includeDeleted
				)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws UnauthorizedAccessError if non-admin user tries to access activities of all users', async () => {
				// act/assert
				expect(async () => await service.fetchActivityCounts(requestingUserId)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws NotFoundError if user matching provided ID does not exist in persistence layer', async () => {
				// arrange
				userRepoFetchByIdSpy?.mockRestore();
				userRepoFetchByIdSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => {
					return Promise.resolve(Result.fail(new NotFoundError('Test Error')));
				});
				let error: Error | undefined;				
				
				// act/assert
				try {
					await service.fetchActivityCounts(
						requestingUserId, // defaults to normal user
						targetUserId, // any other user
						// using default values for query, isAdmin and includeDeleted
					);
				}
				catch (e) {
					error = e;					
				}
				expect(error).toBeInstanceOf(NotFoundError);

				// clean up
				userRepoFetchByIdSpy?.mockRestore();
			});
		});

		describe('fetchAggretagedLogs', () => {
			// NOTE:
			// not testing that AggregatorService works, just that it is called with the right parameters
			// leave deeper testing of the result to AggregatorService tests to avoid duplication
			
			let isAdmin: boolean;
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			beforeEach(() => {
				isAdmin = normalUserCtx.roles.includes('admin');
				requestingUserId = normalUserCtx.userId;
				targetUserId = normalUserCtx.userId;
			});
			
			it('can aggregate a time series of all ConditioningLogs owned by a user', async () => {
				// arrange
				const expectedTimeSeries = service['toConditioningLogSeries'](await service.fetchLogs(requestingUserId, targetUserId));
				
				// act
				const aggregatedSeries = await service.fetchAggretagedLogs(
					requestingUserId,
					aggregationQueryDTO,
					// using default values for query, isAdmin and includeDeleted
				);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalled();
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
				expect(aggregatedSeries).toBeDefined();			
			});
			
			it(`can aggregate a time series of all ConditioningLogs for all users if user role is admin`, async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				requestingUserId = adminUserCtx.userId; // admin user aggregates logs for all users

				// act
				const aggregatedSeries = await service.fetchAggretagedLogs(
					requestingUserId, // admin user
					aggregationQueryDTO, // aggregation query
					undefined, // no query
					isAdmin // isAdmin is true for admin user
				);

				// TODO: Get this without relying on fetchLogs, so we can test the aggregation logic in isolation
				const logsForAllUsers = service['cache'].value.flatMap(entry => entry.logs);
				const expectedTimeSeries = service['toConditioningLogSeries'](logsForAllUsers);
				
				// assert
				const timeSeries = aggregatorSpy.mock.calls[0][0];
				
				expect(aggregatorSpy).toHaveBeenCalled();
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
				expect(aggregatedSeries).toBeDefined();
			});
			
			it('aggreates only logs matching query, if provided', async () => {			
				// arrange
				const searchableLogs = service['cache'].value.find((entry) => entry.userId === normalUserCtx.userId)?.logs ?? [];
				const queryDTO = new QueryDTO({'activity': ActivityType.MTB});
				const query = queryMapper.toDomain(queryDTO);
				const matchingLogs = query.execute(searchableLogs);
				const expectedTimeSeries = service['toConditioningLogSeries'](matchingLogs);

				// act
				const aggregatedSeries = await service.fetchAggretagedLogs(
					requestingUserId, // defaults to normal user
					aggregationQueryDTO,
					queryDTO, // query to filter logs
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);

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

				// TODO: Get this without relying on fetchLogs, so we can test the aggregation logic in isolation
				const expectedTimeSeries = service['toConditioningLogSeries'](await service.fetchLogs(requestingUserId, targetUserId)); // deleted logs excluded by default
				expectedTimeSeries.data.forEach((dataPoint: any) => expect(dataPoint.value.deletedOn).toBeUndefined()); // sanity check, no deleted logs in expected series
				
				// act
				void await service.fetchAggretagedLogs(
					requestingUserId, // defaults to normal user
					aggregationQueryDTO, // aggregation query
					// no query
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			});

			it('optionally can include soft deleted logs', async () => {
				// arrange
				const deletedLog = logsForRandomUser[0];
				deletedLog['_updatedOn'] = undefined;
				deletedLog.deletedOn = new Date(deletedLog.createdOn!.getTime() + 1000);

				// TODO: Get this without relying on fetchLogs, so we can test the aggregation logic in isolation
				const expectedTimeSeries = service['toConditioningLogSeries'](await service.fetchLogs(requestingUserId, targetUserId, undefined, undefined, true)); // include deleted logs
				expect(expectedTimeSeries.data.some((dataPoint: any) => dataPoint.value.deletedOn !== undefined)).toBe(true); // sanity check, deleted logs in expected series
				
				// act
				void await service.fetchAggretagedLogs(
					requestingUserId, // defaults to normal user
					aggregationQueryDTO, // aggregation query
					undefined, // no query
					isAdmin, // isAdmin defaults to false
					true // includeDeleted is true
				);
				
				// assert
				expect(aggregatorSpy).toHaveBeenCalledWith(expectedTimeSeries, aggregationQueryDTO, expect.any(Function));
			});

			it('throws UnauthorizedAccessError if non-admin user tries to access logs of another user', async () => {
				// arrange
				const queryDTO = new QueryDTO({	userId: 'no-such-user'});
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				requestingUserId = otherUser.userId; // other user tries to access logs of another user
				
				// act/assert
				expect(async () => await service.fetchAggretagedLogs(
					requestingUserId,
					aggregationQueryDTO,
					queryDTO
				)).rejects.toThrow(UnauthorizedAccessError);
			});
		});

		describe('fetchLog', () => {
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			let isAdmin: boolean;
			beforeEach(() => {
				requestingUserId = normalUserCtx.userId;
				targetUserId = randomUserId;
				isAdmin = normalUserCtx.roles.includes('admin');
			});

			it('provides details for a conditioning log owned by a user', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					randomLog.sensorLogs = []; // if sensorLogs is not undefined, isOverview will be false
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(randomLog)))
				});
				
				//act
				const detailedLog = await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId!, // random
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);

				// assert
				expect(detailedLog!).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.isOverview).toBe(false);
			});
						
			it(`can provide a details for other user's conditioning log if user role is 'admin'`, async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				const otherUser = users.find(user => user.userId !== requestingUserId)!;
				requestingUserId = adminUserCtx.userId; // admin user fetches log for another user
				targetUserId = otherUser.userId;
				// TODO: Get this without relying on fetchLogs, so we can test the aggregation logic in isolation
				const otherUserLogs = await service.fetchLogs(
					requestingUserId, // admin user
					targetUserId, // any other user
					undefined, // no query
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				);
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];

				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					randomOtherUserLog!.sensorLogs = []; // if sensorLogs is not undefined, isOverview will be false
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(randomOtherUserLog!)))
				});
				
				//act
				const detailedLog = await service.fetchLog(
					requestingUserId, // admin user
					targetUserId, // any other user
					randomOtherUserLog!.entityId!, // random log id
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				);

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
				const detailedLogPromise = service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);
				
				// assert
				expect(async () => await detailedLogPromise).rejects.toThrow(NotFoundError);
			});

			it('optionally can include soft deleted logs', async () => {
				// arrange
				randomLog['_updatedOn'] = undefined;
				randomLog.deletedOn = new Date(randomLog.createdOn!.getTime() + 1000);
				
				// act
				const detailedLog = await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId!, // random log id
					undefined, // isAdmin defaults to false
					true // includeDeleted is true
				);
				
				// assert
				expect(detailedLog).toBeDefined();
				expect(detailedLog).toBeInstanceOf(ConditioningLog);
				expect(detailedLog!.deletedOn).toBeDefined();
			});

			it('returns log directly from cache if already detailed', async () => {
				// arrange					
				logRepoFetchByIdSpy?.mockRestore(); // reset spy to avoid side effects
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById'); // should not be called
				
				// replace random log in cache with detailed log
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				const cache = service['cache'].value;
				const cacheEntry = cache.find(entry => entry.userId === randomUserId);
				const logIndex = cacheEntry!.logs.findIndex(log => log.entityId === randomLogId);
				cacheEntry!.logs[logIndex] = detailedLog;				
				
				//act
				const retrievedLog = await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId!
					// using default values for isAdmin and includeDeleted
				);

				// assert
				expect(retrievedLog?.entityId).toBe(randomLog?.entityId);
				expect(retrievedLog?.isOverview).toBe(false);
				expect(retrievedLog).toBe(detailedLog);

				expect(logRepoFetchByIdSpy).not.toHaveBeenCalled(); // may/not be reliable, but should be true
			});

			it('retrieves detailed log from persistence if cached log is overview', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					//  logs are initialized in cache as overviews, so any random cached log should be an overview
					const randomLogId = randomLog!.entityId!;
					const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
					const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});

				// act
				const retrievedLog = await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				);

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
				const retrievedLog = await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				);

				// assert
				expect(retrievedLog?.isOverview).toBe(true);
			});
			
			it('replaces log in cache with detailed log from persistence ', async () => {
				// arrange
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					//  logs are initialized in cache as overviews, so any random cached log should be an overview
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});
				
				// act
				void await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				);

				// assert
				const updatedLog = service['cache'].value.find(entry => entry.userId === randomUserId)?.logs.find(log => log.entityId === randomLogId);
				expect(updatedLog).toBe(detailedLog);
			});

			it('updates cache subcribers when replacing log from persistence ', async () => {
				// arrange
				const randomLogId = randomLog!.entityId!;
				const dto = testDTOs.find(dto => dto.entityId === randomLogId)!;
				const detailedLog = ConditioningLog.create(dto, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					// logs are initialized in cache as overviews, so any random cached log should be an overview
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(detailedLog!)))
				});
				
				// act
				void await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				);

				// assert
				const updatedCache$ = service['cache'].asObservable();
				const updatedCache = await firstValueFrom(updatedCache$);
				const updatedLog = updatedCache.find(entry => entry.userId === randomUserId)?.logs.find(log => log.entityId === randomLogId);
				expect(updatedLog).toBe(detailedLog);
			});
			
			it('throws UnauthorizedAccessError if user is not authorized to access log', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				targetUserId = otherUser.userId;

				// act/assert
				expect(async () => service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				)).rejects.toThrow(UnauthorizedAccessError);
			});
			
			it('throws NotFoundError if no log is found matching provided log entity id', async () => {
				// arrange
				// act/assert
				expect(async () => await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					'no-such-log',
					// using default values for isAdmin and includeDeleted
				)).rejects.toThrow(NotFoundError);
			});
		
			it('throws UnauthorizedAccessError if log is found but user is not authorized to access it', async () => {
				// arrange
				normalUserCtx.roles = ['user'];
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				targetUserId = otherUser.userId;
				const otherUserLogs = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					undefined, // no query
					true, // isAdmin
					// includeDeleted defaults to false
				);
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);
				
				// act/assert
				expect(() => service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					randomOtherUserLogId.value, // random log id
					// using default values for isAdmin and includeDeleted
				)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws PersistenceError if retrieving detailed log from persistence fails', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					// console.debug('fetchById mock called'); this gets called, despite toHaveBeenCalled() failing
					return Promise.resolve(Result.fail<Observable<ConditioningLog<any, ConditioningLogDTO>>>('test error'))
				});

				// act/assert
					// tried, failed to verify that repoSpy is called using .toHaveBeenCalled()
				expect(async () => await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				)).rejects.toThrow(PersistenceError);
			});

			it('throws NotFoundError if no log matching entity id is found in persistence', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.ok<any>(of(undefined)));
				});

				// act/assert
				expect(async () => await service.fetchLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog.entityId! // random log id
					// using default values for isAdmin and includeDeleted
				)).rejects.toThrow(NotFoundError);
			});
		});

		describe('fetchLogs', () => {
			let allCachedLogs: ConditioningLog<any, ConditioningLogDTO>[];
			let isAdmin: boolean;		
			let queryDTO: QueryDTO;
			let queryDTOProps: QueryDTOProps;
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			beforeEach(() => {
				allCachedLogs = [...service['cache'].value]
					.flatMap(entry => entry.logs)				
					.sort((a: any, b: any) => a.start.getTime() - b.start.getTime()); // ascending
				const earliestStart = allCachedLogs[0].start;
				
				allCachedLogs.sort((a: any, b: any) => a.end.getTime() - b.end.getTime()); // ascending
				const latestEnd = allCachedLogs[allCachedLogs.length - 1].end;

				isAdmin = normalUserCtx.roles.includes('admin');
				
				queryDTOProps = {
					start: earliestStart!.toISOString(),
					end: latestEnd!.toISOString(),
					activity: ActivityType.MTB,
					userId: normalUserCtx.userId as unknown as string,
					sortBy: 'duration',
					order: 'ASC',
					//page: 1, // paging not yet implemented
					//pageSize: 10,
				};
				queryDTO = new QueryDTO(queryDTOProps);

				requestingUserId = normalUserCtx.userId;
				targetUserId = randomUserId;
			});

			it('gives normal users access to a collection of all their conditioning logs', async () => {
				// arrange
				// act
				const matches = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					// no query, isAdmin defaults to false, includeDeleted defaults to false
				);
				
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
				const matches = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					queryDTO, // query to filter logs
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);					
				
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
				const matches = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					//  no query
					// isAdmin defaults to false
					// includeDeleted defaults to false
				);
				
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
				const matches = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					undefined, // no query
					false, // isAdmin
					true // includeDeleted is true
				);
				
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
				const targetUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				targetUserId = targetUser.userId;
				queryDTO.userId = targetUserId as unknown as string;
				
				// act/assert
				expect(async () => await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					queryDTO, // query to filter logs
					// isAdmin defaults to false
					// includeDeleted defaults to false
				)).rejects.toThrow(UnauthorizedAccessError);
			});
			
			it('gives admin users access to all logs for all users', async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				requestingUserId = adminUserCtx.userId; // admin user fetches logs for all users
				
				// act
				const allLogs = await service.fetchLogs(
					requestingUserId, // admin user
					undefined, // no target user, so all users
					undefined, // no query
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				);
							
				// assert
				expect(allLogs).toBeDefined();
				expect(allLogs).toBeInstanceOf(Array);
				expect(allLogs.length).toBe(testDTOs.length);
			});

			it('optionally gives admin users access to all logs matching a query', async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				requestingUserId = adminUserCtx.userId; // admin user fetches logs for
				
				const queryDtoClone = new QueryDTO(queryDTOProps);
				queryDtoClone.userId = undefined; // logs don't have userId, so this should be ignored
				const query = queryMapper.toDomain(queryDtoClone); // mapper excludes undefined properties
				const expectedLogs = query.execute(allCachedLogs); // get matching logs from test data			
							
				// act
				const allLogs = await service.fetchLogs(
					requestingUserId, // admin user
					undefined, // no target user, so all users
					queryDTO, // query to filter logs
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				);
				
				// assert
				expect(allLogs).toBeDefined();
				expect(allLogs).toBeInstanceOf(Array);
				expect(allLogs.length).toBe(expectedLogs.length);
			});
			
			it('by default sorts logs ascending by start date and time, if available', async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				requestingUserId = adminUserCtx.userId; // admin user fetches logs for all users
				
				// act
				const allLogs = await service.fetchLogs(
					requestingUserId, // admin user
					undefined, // no target user, so all users
					undefined, // no query
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				);
				
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
				// until we have a mock of import dataService with mock data,
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
				const expectedCache = service['cache'].value;
				const handler = new ConditioningLogCreatedHandler(logRepo);
				
				// act
				const snapshot = service.getCacheSnapshot(handler);
				
				// assert
				expect(snapshot).toBeDefined();
				expect(snapshot).toEqual(expectedCache);
			});

			it('throws an UnauthorizedAccessError if caller is not an instance of a domain event handler', async () => {
				// arrange
				const caller = { name: 'test' };
				
				// act/assert
				expect(() => service.getCacheSnapshot(caller as any)).toThrow(UnauthorizedAccessError);				
			});
		});
		
		describe('updateCache', () => {
			it('can update the cache with a new snapshot', async () => {
				// arrange
				const newCache = [...service['cache'].value];
				const handler = new ConditioningLogCreatedHandler(logRepo);
				
				// act
				service.updateCache(newCache, handler);
				
				// assert
				const newSnapshot = service.getCacheSnapshot(handler);
				expect(newSnapshot).toEqual(newCache);
			});

			it('throws an UnauthorizedAccessError if caller is not an instance of a domain event handler', async () => {
				// arrange
				const caller = { name: 'test' };
				
				// act/assert
				expect(() => service.updateCache([], caller as any)).toThrow(UnauthorizedAccessError);				
			});
		});
		
		describe('updateLog', () => {
			let isAdmin: boolean;
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			let updatedLog: ConditioningLog<any, ConditioningLogDTO>;
			let updatedLogDTO: ConditioningLogDTO;
			let logRepoUpdateSpy: any;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				isAdmin = normalUserCtx.roles.includes('admin');
				requestingUserId = normalUserCtx.userId;
				targetUserId = randomUserId;
				updatedLogDTO = {...randomLog!.toJSON()};
				updatedLogDTO.activity = ActivityType.RUN;
				updatedLogDTO.duration = {unit: 'ms', value: 100 }; // 100 ms
				updatedLog = ConditioningLog.create(updatedLogDTO, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
								
				logRepoUpdateSpy = jest.spyOn(logRepo, 'update').mockImplementation(() => {
					return Promise.resolve(Result.ok<ConditioningLog<any, ConditioningLogDTO>>(updatedLog))
				});

				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.ok<Observable<ConditioningLog<any, ConditioningLogDTO>>>(of(updatedLog)))
				});		

				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
			});

			afterEach(() => {
				logRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('updates a conditioning log with new data and persists it in log repo', async () => {
				// arrange
				updatedLog.activity = ActivityType.RUN;
				
				// act
				void await service.updateLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					randomLog!.entityId!,
					updatedLog
				);

				// assert
				expect(logRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(logRepoUpdateSpy).toHaveBeenCalledWith(updatedLog.toPersistenceDTO());
			});

			it('replaces log in cache with updated log following log repo update', async () => {
				// arrange
				service.updateLog(
					requestingUserId,
					targetUserId,
					randomLog!.entityId!,
					updatedLog).then(() => {
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
					const sub = service['cache'].subscribe(updatedCache => {
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

			it('succeeds if admin user updates log for another user', async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				requestingUserId = adminUserCtx.userId; // admin user updates log for another user
				targetUserId = otherUser.userId;
				const otherUserLogs = await service.fetchLogs(
					requestingUserId, // admin user
					targetUserId, // any other user
					undefined, // no query
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				);
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);

				// act
				void await service.updateLog(
					requestingUserId, // admin user updates log for another user
					targetUserId, // any other user
					randomOtherUserLogId.value, // random log id
					updatedLog,
					isAdmin // isAdmin is true for admin user
				);

				// assert
				expect(logRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(logRepoUpdateSpy).toHaveBeenCalledWith({...updatedLog.toPersistenceDTO(), entityId: randomOtherUserLog.entityId });
			});

			it('throws UnauthorizedAccessError if non-admin user tries to update log for another user', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				targetUserId = otherUser.userId;
				const otherUserLogs = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					undefined, // no query
					true // isAdmin
					// includeDeleted defaults to false
				)
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const logId = randomOtherUserLog!.entityId!;
				let error: Error | undefined;

				// act/assert
				try {
					await service.updateLog(
						requestingUserId, // defaults to normal user
						targetUserId, // any other user
						logId, // random log id
						updatedLog // updated log
						// isAdmin defaults to false
					);
				}
				catch (e) {
					error = e;
				}
				expect(error).toBeDefined();
				expect(error).toBeInstanceOf(UnauthorizedAccessError);
			});

			it('throws NotFoundError if log does not exist in persistence layer', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => 
					Promise.resolve(Result.fail('test error'))
				);
				logRepoUpdateSpy?.mockRestore();
				logRepoUpdateSpy = jest.spyOn(logRepo, 'update').mockImplementation(() => 
					Promise.resolve(Result.fail<ConditioningLog<any, ConditioningLogDTO>>('test error'))
				);
				let error: Error | undefined;

				// act/assert
				try {
					await service.updateLog(
						requestingUserId, // defaults to normal user
						targetUserId, // same user
						randomLog!.entityId!, // random log id
						updatedLog // updated log
					);
				}
				catch (e) {
					error = e;					
				}
				expect(error).toBeDefined();
				expect(error).toBeInstanceOf(NotFoundError);

				// clean up
				logRepoFetchByIdSpy?.mockRestore();
				logRepoUpdateSpy?.mockRestore();
			});

			it('throws PersistenceError if updating log in persistence layer fails', async () => {
				// arrange
				logRepoUpdateSpy?.mockRestore();
				logRepoUpdateSpy = jest.spyOn(logRepo, 'update').mockImplementation(() => {
					return Promise.resolve(Result.fail('test error'))
				});
				let error: Error | undefined;

				// act/assert
				try {
					await service.updateLog(
						requestingUserId, // defaults to normal user
						targetUserId, // same user
						randomLog!.entityId!, // random log id
						updatedLog // updated log
						// isAdmin defaults to false
					);
				}
				catch (e) {
					error = e;
				}
				expect(error).toBeDefined();
				expect(error).toBeInstanceOf(PersistenceError);

				// clean up
				logRepoUpdateSpy?.mockRestore();
			});
		});

		describe('deleteLog', () => {
			let isAdmin: boolean;
			let logId: EntityId;
			let logRepoDeleteSpy: any;
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				isAdmin = normalUserCtx.roles.includes('admin');
				logId = randomLog!.entityId!;

				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.ok<void>());
				});

				requestingUserId = normalUserCtx.userId;
				targetUserId = randomUserId;

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
				void await service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					logId // log id to delete
					// softDelete defaults to true
					// isAdmin defaults to false
				);

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(logIdDTO.value, true); // true: soft delete is default
			});

			it('by default soft deletes log', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					logId // log id to delete
					// softDelete defaults to true
					// isAdmin defaults to false
				);

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(logIdDTO.value, true); // true: soft delete is default
			});

			it('optionally can hard delete log', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					logId, // log id to delete
					false // hard delete
					// isAdmin defaults to false
				);

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(logIdDTO.value, false);
			});

			it('removes hard deleted log from user and persists user changes in user repo', async () => {
				// arrange
				const logIdDTO = new EntityIdDTO(randomLog!.entityId!);

				// act
				void await service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					logId, // log id to delete
					false // hard delete
					// isAdmin defaults to false
				);

				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(randomUser.toJSON());
			});

			it('removes deleted log from cache following user repo update', async () => {
				// arrange
				const deletedLogId = randomLog!.entityId!;				

				expect(randomUser.logs).toContain(deletedLogId); // sanity check

				service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					deletedLogId, // log id to delete
					// softDelete defaults to false
					// isAdmin defaults to false
					
				).then(() => {
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
					const sub = service['cache'].subscribe(updatedCache => {
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

			it('succeeds if admin user deletes log for another user', async () => {
				// arrange
				isAdmin = true; // isAdmin is true for admin user
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				requestingUserId = adminUserCtx.userId; // admin user deletes log for another user
				targetUserId = otherUser.userId;
				const otherUserLogs = await service.fetchLogs(
					requestingUserId, // admin user
					targetUserId, // any other user
					undefined, // no query
					isAdmin, // isAdmin is true for admin user
					// includeDeleted defaults to false
				)
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = randomOtherUserLog!.entityId!;

				// act
				expect(() => service.deleteLog(
					requestingUserId,
					targetUserId,
					randomOtherUserLogId,
					false, // softDelete
					isAdmin
				)).not.toThrow();
			});

			it('throws UnauthorizedAccessError if non-admin user tries to delete log for another user', async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== requestingUserId)!;
				targetUserId = otherUser.userId;
				const otherUserLogs = await service.fetchLogs(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					undefined, // no query
					true, // isAdmin
					// includeDeleted defaults to false
				);
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = randomOtherUserLog!.entityId!;

				// act/assert
				expect(() => service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // any other user
					randomOtherUserLogId, // random log id
					// using default values for isAdmin and includeDeleted
				)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws NotFoundError if no log is found in persistence layer matching provided log entity id', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.fail<void>('test error')) as any;
				});

				let error: Error | undefined;

				// act/assert
				try { // cannot get jest to catch the error, so using try/catch
					await service.deleteLog(
						requestingUserId, // defaults to normal user
						targetUserId, // same user
						'no-such-log', // log id that does not exist
						// using default values for softDelete and isAdmin
					);
				}
				catch (e) {
					error = e;
					expect(e).toBeInstanceOf(NotFoundError);
				}
				expect(error).toBeDefined();
				
				// clean up
				logRepoFetchByIdSpy?.mockRestore();
			});

			it('throws PersistenceError if updating user in user repo fails (hard delete)', async () => {
				// arrange
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.fail('test error'))
				);
				let error: Error | undefined;

				// act/assert
				try { // cannot get jest to catch the error, so using try/catch
					await service.deleteLog(
						requestingUserId, // defaults to normal user
						targetUserId, // same user
						logId, // log id to delete
						false // hard delete - user only updated when hard deleting
						// isAdmin defaults to false
					);
				}
				catch (e) {
					error = e;
					expect(e).toBeInstanceOf(PersistenceError);
				}
				expect(error).toBeDefined();

				// clean up
				userRepoUpdateSpy?.mockRestore();
			});

			it('does not update user if soft deleting log', async () => {
				// arrange
				// act
				void await service.deleteLog(
					requestingUserId, // defaults to normal user
					targetUserId, // same user
					logId, // log id to delete
					// softDelete defaults to true
					// isAdmin defaults to false
				);

				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(0);
			});

			it('throws PersistenceError if deleting log in log repo fails', async () => {
				// arrange
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});
				let error: Error | undefined;

				// act/assert
				try { // cannot get jest to catch the error, so using try/catch
					await service.deleteLog(
						requestingUserId, // defaults to normal user
						targetUserId, // same user
						logId, // log id to delete
						// using default values for softDelete and isAdmin
					);
				}
				catch (e) {
					error = e;
					expect(e).toBeInstanceOf(PersistenceError);
				}
				expect(error).toBeDefined();

				// clean up
				logRepoDeleteSpy?.mockRestore();
			});
		});

		/*describe('undeleteLog', () => {
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
				void await service.undeleteLog(normalUserCtx, randomUserIdDTO, logIdDTO);

				// assert
				expect(logRepoUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoUndeleteSpy).toHaveBeenCalledWith(logIdDTO.value);
			});

			it('restores undeleted log in cache following log repo update', async () => {
				// arrange
				const undeletedLogId = randomLog!.entityId!;
				const undeletedLogIdDTO = new EntityIdDTO(undeletedLogId);

				expect(randomUser.logs).toContain(undeletedLogId); // sanity check

				service.undeleteLog(normalUserCtx, randomUserIdDTO, undeletedLogIdDTO).then(() => {
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
					const sub = service['cache'].subscribe(updatedCache => {
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
				normalUserCtx.roles = ['admin'];
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				const otherUserIdDTO = new EntityIdDTO(otherUser.userId);
				const otherUserLogs = await service.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);

				// act/assert
				expect(() => service.undeleteLog(normalUserCtx, otherUserIdDTO, randomOtherUserLogId)).not.toThrow();
			});

			it(`throws UnauthorizedAccessError if non-admin user tries to undelete other user's log`, async () => {
				// arrange
				const otherUser = users.find(user => user.userId !== normalUserCtx.userId)!;
				const otherUserIdDTO = new EntityIdDTO(otherUser.userId);
				const otherUserLogs = await service.fetchLogs(new UserContext({userId: otherUser.userId, userName: 'testuser', userType: 'user', roles: ['user']}), new EntityIdDTO(otherUser.userId));
				const randomOtherUserLog = otherUserLogs[Math.floor(Math.random() * otherUserLogs.length)];
				const randomOtherUserLogId = new EntityIdDTO(randomOtherUserLog!.entityId!);
				
				// act/assert
				expect(() => service.undeleteLog(normalUserCtx, otherUserIdDTO, randomOtherUserLogId)).rejects.toThrow(UnauthorizedAccessError);
			});

			it('throws NotFoundError if no log is found in persistence layer matching provided log entity id', async () => {
				// arrange
				logRepoFetchByIdSpy?.mockRestore();
				logRepoFetchByIdSpy = jest.spyOn(logRepo, 'fetchById').mockImplementation(async () => {
					return Promise.resolve(Result.fail<void>('test error')) as any;
				});

				let error: Error | undefined;

				// act/assert
				try { // cannot get jest to catch the error, so using try/catch
					await service.undeleteLog(normalUserCtx, randomUserIdDTO, new EntityIdDTO('no-such-log'));
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
				logRepoUndeleteSpy?.mockRestore();
				logRepoUndeleteSpy = jest.spyOn(logRepo, 'undelete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});

				// act/assert
				expect(async () => await service.undeleteLog(normalUserCtx, randomUserIdDTO, new EntityIdDTO(randomLog!.entityId!))).rejects.toThrow(PersistenceError);
			});
		})*/
	});

	describe('Protected Methods', () => {
		describe('toConditioningLogSeries', () => {
			let requestingUserId: EntityId;
			let targetUserId: EntityId;
			beforeEach(() => {
				requestingUserId = normalUserCtx.userId;
				targetUserId = randomUserId;
			});

			it('converts an array of logs to a time series with correct structure', async () => {
				// Arrange
				const logs = await service.fetchLogs(requestingUserId, targetUserId);
				
				// Act
				const series = service['toConditioningLogSeries'](logs);
				
				// Assert
				expect(series).toBeDefined();
				expect(series.unit).toBe('ConditioningLog');
				expect(series.start).toEqual(logs[0].start);
				expect(series.data).toBeInstanceOf(Array);
				expect(series.data.length).toBe(logs.length);
				
				// Check data point structure
				series.data.forEach((dataPoint, index) => {
				expect(dataPoint.timeStamp).toEqual(logs[index].start);
				expect(dataPoint.value).toBe(logs[index]);
				});
			});

			it('sorts logs by start date in ascending order', async () => {
				// Arrange
				const logs = await service.fetchLogs(requestingUserId, targetUserId);
				// Deliberately unsort logs to test sorting
				const unsortedLogs = [...logs].sort((a, b) => 
				(b.start?.getTime() || 0) - (a.start?.getTime() || 0)
				);
				
				// Act
				const series = service['toConditioningLogSeries'](unsortedLogs);

				// Assert
				expect(series.data.length).toBe(logs.length);
				
				// Verify ascending order
				for (let i = 1; i < series.data.length; i++) {
				expect((series.data[i].timeStamp as Date).getTime()).toBeGreaterThanOrEqual(
					(series.data[i-1].timeStamp as Date).getTime()
				);
				}
			});

			it('excludes logs without start dates', async () => {
				// Arrange
				const logs = await service.fetchLogs(requestingUserId, targetUserId);
				const logDTO = { ...randomLog.toDTO(), entityId: 'missing-start', start: undefined };
				const logWithoutStart = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				const logsWithMissing = [...logs, logWithoutStart];
				
				// Act
				const series = service['toConditioningLogSeries'](logsWithMissing);

				// Assert
				expect(series.data.length).toBe(logs.length); // Missing date log should be excluded
				expect(series.data.some(dp => dp.value.entityId === 'missing-start')).toBe(false);
			});

			it('handles an empty array of logs', () => {
				// Act
				const series = service['toConditioningLogSeries']([]);
				
				// Assert
				expect(series.unit).toBe('ConditioningLog');
				expect(series.start).toBeUndefined();
				expect(series.data).toEqual([]);
			});

			it('logs warnings for logs without start dates', async () => {
				// Arrange
				const logDTO = { entityId: 'no-start-date', activity: ActivityType.RUN, className: 'ConditioningLog' };
				const logWithoutStart = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				const logSpy = jest.spyOn(service.logger, 'warn').mockImplementation(() => {});
				
				// Act
				service['toConditioningLogSeries']([logWithoutStart]);

				// Assert
				expect(logSpy).toHaveBeenCalledWith(
				`Conditioning log no-start-date has no start date, excluding from ConditioningLogSeries.`
				);
				
				// Clean up
				logSpy.mockRestore();
			});
			
			it('preserves log references in data points', async () => {
				// Arrange
				const logs = await service.fetchLogs(requestingUserId, targetUserId);
				
				// Act
				const series = service['toConditioningLogSeries'](logs);
				
				// Assert
				series.data.forEach((dataPoint, index) => {
				// Should be the same object reference, not a copy
				expect(dataPoint.value).toBe(
					logs.find(log => log.entityId === dataPoint.value.entityId)
				);
				});
			});
		});
	});

	describe('Management API', () => {
		// NOTE: no need to fully retest ManagedStatefulComponentMixin methods,
		 // as they are already tested in the mixin.
		 // Just do a few checks that things are hooked up correctly,
		 // and that local implementations work correctly.									
			
		beforeEach(async () => {
			// reset the service before each test
			await service.shutdown(); // clear subscriptions and cache, and set state to SHUT_DOWN
			service['msc_zh7y_stateSubject'].next({name: 'ConditioningDataService', state: ComponentState.UNINITIALIZED, updatedOn: new Date()}); // set state to UNINITIALIZED
		});		
		
		describe('ManagedStatefulComponentMixin Members', () => {
			it('inherits componentState$ ', () => {
				expect(service).toHaveProperty('componentState$');
				expect(service.componentState$).toBeDefined();
				expect(service.componentState$).toBeInstanceOf(Observable);
			});

			it('inherits initialize method', () => {
				expect(service).toHaveProperty('initialize');
				expect(service.initialize).toBeDefined();
				expect(service.initialize).toBeInstanceOf(Function);
			});

			it('inherits shutdown method', () => {
				expect(service).toHaveProperty('shutdown');
				expect(service.shutdown).toBeDefined();
				expect(service.shutdown).toBeInstanceOf(Function);
			});

			it('inherits isReady method', () => {
				expect(service).toHaveProperty('isReady');
				expect(service.isReady).toBeDefined();
				expect(service.isReady).toBeInstanceOf(Function);
			});

			it('inherits registerSubcomponent method', () => {
				expect(service).toHaveProperty('registerSubcomponent');
				expect(service.registerSubcomponent).toBeDefined();
				expect(service.registerSubcomponent).toBeInstanceOf(Function);
			});

			it('inherits unregisterSubcomponent method', () => {
				expect(service).toHaveProperty('unregisterSubcomponent');
				expect(service.unregisterSubcomponent).toBeDefined();
				expect(service.unregisterSubcomponent).toBeInstanceOf(Function);
			});
		});

		describe('State Transitions', () => {
			it('is in UNINITIALIZED state before initialization', async () => {
				// arrange
				const stateInfo = await firstValueFrom(service.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state

				// act
				
				// assert
				expect(stateInfo).toBeDefined();
				expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
			});

			it('is in OK state after initialization', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = service.componentState$.subscribe((s) => {
					state = s.state;
				});

				expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check

				// act
				await service.initialize();

				// assert
				expect(state).toBe(ComponentState.OK);

				// clean up
				sub.unsubscribe();
			});

			it('is in SHUT_DOWN state after shutdown', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = service.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				await service.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
				
				// act			
				await service.shutdown();

				// assert
				expect(state).toBe(ComponentState.SHUT_DOWN);

				// clean up
				sub.unsubscribe();
			});
		});
		
		describe('initialize', () => {	
			it('calls onInitialize', async () => {				
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = service.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				const onInitializeSpy = jest.spyOn(service, 'onInitialize').mockReturnValue(Promise.resolve());
	
				// act
				await service.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
	
				// assert
				expect(onInitializeSpy).toHaveBeenCalledTimes(1);
				expect(onInitializeSpy).toHaveBeenCalledWith(undefined);

				// clean up
				sub.unsubscribe();
				onInitializeSpy?.mockRestore();
			});			
		});

		describe('isReady', () => {		
			it('reports if/when it is initialized (i.e. ready)', async () => {
				// arrange
				await service.initialize(); // initialize the service

				// act
				const result = await service.isReady();

				// assert
				expect(result).toBe(true);
			});
		});		

		describe('shutdown', () => {
			it('calls onShutdown', async () => {				
				// arrange
				const onShutdownSpy = jest.spyOn(service, 'onShutdown').mockReturnValue(Promise.resolve());
				
				// act
				await service.shutdown();
	
				// assert
				expect(onShutdownSpy).toHaveBeenCalledTimes(1);
				expect(onShutdownSpy).toHaveBeenCalledWith(undefined);

				// clean up
				onShutdownSpy?.mockRestore();
			});
		});
	});

	/*
	describe('Protected Methods', () => {
		describe('rollbackLogCreation', () => {
			let logRepoDeleteSpy: any;
			beforeEach(() => {
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.ok<void>());
				});
			});

			afterEach(() => {
				logRepoDeleteSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('deletes an orphaned conditioning log and removes it from log repo', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				
				// act
				void await service['rollbackLogCreation'](orphanedLogId, undefined, 1, 10); // 1 retry, 10ms wait
				

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(orphanedLogId, false); // hard delete
			});

			it('by default hard deletes an orphaned log', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				
				// act
				void await service['rollbackLogCreation'](orphanedLogId, undefined, 1, 10); // 1 retry, 10ms wait

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(orphanedLogId, false); // hard delete
			});

			it('optionally can soft delete an orphaned log', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				
				// act
				void await service['rollbackLogCreation'](orphanedLogId, true, 1, 10); // 1 retry, 10ms wait

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(logRepoDeleteSpy).toHaveBeenCalledWith(orphanedLogId, true); // soft delete
			});

			it('by default retries deleting an orphaned log 4 times if initial attempt fails', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});

				// act
				void await service['rollbackLogCreation'](orphanedLogId, undefined, undefined, 10); // default retries, 10ms wait

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(6); // initial attempt + 5 retries (default)

				// clean up
				logRepoDeleteSpy?.mockRestore();
			});

			it('optionally can retry deleting an orphaned log a specified number of times if initial attempt fails', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});

				// act
				void await service['rollbackLogCreation'](orphanedLogId, undefined, 2, 10); // 2 retries, 10ms wait

				// assert
				expect(logRepoDeleteSpy).toHaveBeenCalledTimes(3); // initial attempt + 2 retries

				// clean up
				logRepoDeleteSpy?.mockRestore();
			});

			it('by default waits 500ms between retries when deleting an orphaned log', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});

				const start = Date.now();
				// act
				void await service['rollbackLogCreation'](orphanedLogId, undefined, 1); // 1 retry, default wait time

				// assert
				const end = Date.now();
				const elapsed = end - start;
				expect(elapsed).toBeGreaterThanOrEqual(500); // default wait time

				// clean up
				logRepoDeleteSpy?.mockRestore();
			});

			it('optionally can specify wait time between retries when deleting an orphaned log', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});

				const start = Date.now();
				// act
				void await service['rollbackLogCreation'](orphanedLogId, false, 1, 50); // 1 retry, 100ms wait

				// assert
				const end = Date.now();
				const elapsed = end - start;
				expect(elapsed).toBeGreaterThanOrEqual(50); // specified wait time

				// clean up
				logRepoDeleteSpy?.mockRestore();
			});

			it('logs error if deleting an orphaned log fails', async () => {
				// arrange
				const orphanedLogId = randomLog!.entityId!;
				logRepoDeleteSpy?.mockRestore();
				logRepoDeleteSpy = jest.spyOn(logRepo, 'delete').mockImplementation(() => {
					return Promise.resolve(Result.fail<void>('test error'));
				});
				const logSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => { }); // do nothing

				// act
				void await service['rollbackLogCreation'](orphanedLogId, undefined, 1, 10); // 1 retry, 10ms wait

				// assert
				expect(logSpy).toHaveBeenCalled(); // bug: spy on service logger.error() instead
				expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`Error rolling back log creation for ${orphanedLogId}`), "test error");
				
				// clean up
				logRepoDeleteSpy?.mockRestore();
				logSpy?.mockRestore();
			});
		});

		describe('rollBackUserUpdate', () => {
			let originalPersistenceDTO: UserPersistenceDTO;
			let userRepoUpdateSpy: any;
			beforeEach(() => {
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.ok(randomUser))
				);
				originalPersistenceDTO = randomUser.toPersistenceDTO();
			});

			afterEach(() => {
				userRepoUpdateSpy?.mockRestore();
				jest.clearAllMocks();
			});

			it('reverts changes to a user following a failed user update', async () => {
				// arrange
				
				// act
				void await service['rollBackUserUpdate'](originalPersistenceDTO, 1, 10); // 1 retry, 10ms wait

				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledWith(originalPersistenceDTO);
			});

			it('by default retries updating user 4 times if initial attempt fails', async () => {
				// arrange
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.fail('test error'))
				);

				// act
				void await service['rollBackUserUpdate'](originalPersistenceDTO, undefined, 10); // default retries, 10ms wait

				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(6); // initial attempt + 5 retries (default)

				// clean up
				userRepoUpdateSpy?.mockRestore();
			});

			it('optionally can retry updating user a specified number of times if initial attempt fails', async () => {
				// arrange
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.fail('test error'))
				);

				// act
				void await service['rollBackUserUpdate'](originalPersistenceDTO, 2, 10); // 2 retries, 10ms wait

				// assert
				expect(userRepoUpdateSpy).toHaveBeenCalledTimes(3); // initial attempt + 2 retries

				// clean up
				userRepoUpdateSpy?.mockRestore();
			});

			it('by default waits 500ms between retries when updating user', async () => {
				// arrange
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.fail('test error'))
				);
				const start = Date.now();

				// act
				void await service['rollBackUserUpdate'](originalPersistenceDTO, 1); // 1 retry

				// assert
				const end = Date.now();
				const elapsed = end - start;
				expect(elapsed).toBeGreaterThanOrEqual(500); // default wait time

				// clean up
				userRepoUpdateSpy?.mockRestore();
			});

			it('optionally can specify wait time between retries when updating user', async () => {
				// arrange
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.fail('test error'))
				);				
				const start = Date.now();

				// act
				void await service['rollBackUserUpdate'](originalPersistenceDTO, 1, 50); // 1 retry, 100ms wait

				// assert
				const end = Date.now();
				const elapsed = end - start;
				expect(elapsed).toBeGreaterThanOrEqual(50); // specified wait time

				// clean up
				userRepoUpdateSpy?.mockRestore();
			});

			it('logs error if user update fails', async () => {
				// arrange
				const error = new Error('test error');
				userRepoUpdateSpy?.mockRestore();
				userRepoUpdateSpy = jest.spyOn(userRepo, 'update').mockImplementation(() =>
					Promise.resolve(Result.fail(error))
				);
				const logSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => { }); // do nothing

				// act
				void await service['rollBackUserUpdate'](originalPersistenceDTO, 1, 10); // 1 retry, 10ms wait

				// assert
				expect(logSpy).toHaveBeenCalled();
				expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Error rolling back user update for testuser"), "Error: test error");
				
				// clean up
				userRepoUpdateSpy?.mockRestore();
				logSpy?.mockRestore();
			});
		});

		//todo: subscribeToRepoEvents

		describe('toConditioningLogSeries', () => {
			let userIdDTO: EntityIdDTO;
			beforeEach(() => {
				userIdDTO = new EntityIdDTO(normalUserCtx.userId);
			});

			it('can convert an array of ConditioningLogs to a ConditioningLogSeries', async () => {
				// arrange
				const logs = await service.fetchLogs(normalUserCtx, userIdDTO);
				
				// act
				const series = service['toConditioningLogSeries'](logs);
				
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
				const logs = await service.fetchLogs(normalUserCtx, userIdDTO);
				const unSortedLogs = logs.sort((a, b) => b.start!.getTime() - a.start!.getTime());
				
				// act
				const series = service['toConditioningLogSeries'](logs);

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
				const logs = await service.fetchLogs(normalUserCtx, userIdDTO);
				logDTO.start = undefined;
				const logWithoutStart = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logs.push(logWithoutStart);
				
				// act
				const series = service['toConditioningLogSeries'](logs);

				// assert
				expect(series.data.length).toBe(logs.length - 1);
			});

			it('logs entity id of logs without start date', async () => {
				// arrange
				const logs = await service.fetchLogs(normalUserCtx, userIdDTO);
				logDTO.start = undefined;
				const logWithoutStart = ConditioningLog.create(logDTO, undefined, true).value as ConditioningLog<any, ConditioningLogDTO>;
				logs.push(logWithoutStart);
				const logSpy = jest.spyOn(service.logger, 'warn').mockImplementation(() => { }); // do nothing
				
				// act
				void service['toConditioningLogSeries'](logs);

				// assert
				expect(logSpy).toHaveBeenCalled();
				expect(logSpy).toHaveBeenCalledWith(`Conditioning log ${logWithoutStart.entityId} has no start date, excluding from ConditioningLogSeries.`);
				
				// clean up
				logSpy?.mockRestore();
			});			
		});
	});
	*/
	
	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(service.log$).toBeDefined();
				expect(service.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(service.logger).toBeDefined();
				expect(service.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(service.logToStream).toBeDefined();
				expect(typeof service.logToStream).toBe('function');
			});
		});
	});
});