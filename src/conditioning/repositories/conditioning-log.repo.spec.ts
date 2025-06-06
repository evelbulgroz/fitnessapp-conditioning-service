import { TestingModule } from '@nestjs/testing';

import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom, Observable, take } from 'rxjs';

import { ComponentState, ComponentStateInfo, ManagedStatefulComponentMixin } from "../../libraries/managed-stateful-component";
import { DeviceType, ActivityType, SensorType } from '@evelbulgroz/fitnessapp-base';
import { EntityMetadataDTO, Result } from '@evelbulgroz/ddd-base';

import ConditioningLogRepository from './conditioning-log.repo';
import ConditioningLog from '../domain/conditioning-log.entity';
import ConditioningLogDTO from '../dtos/conditioning-log.dto';
import ConditioningLogPersistenceDTO from '../dtos/conditioning-log-persistence.dto';
import createTestingModule from '../../test/test-utils';
import ManagedStatefulFsPersistenceAdapter from '../../shared/repositories/adapters/managed-stateful-fs-persistence-adapter';

class PersistenceAdapterMock<T extends ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>
	extends ManagedStatefulComponentMixin(ManagedStatefulFsPersistenceAdapter<any>) {
	// cannot get generics to work with jest.fn(), so skipping for now
	// initialize() provided by ManagedStatefulComponentMixin, so no need to mock it
	public create = jest.fn();
	public update = jest.fn();
	public delete = jest.fn();
	public fetchById = jest.fn();
	public fetchAll = jest.fn();
	public undelete = jest.fn();
	// shutdown() provided by ManagedStatefulComponentMixin, so no need to mock it
}

// process.env.NODE_ENV = 'not-test'; // set NODE_ENV to not 'test' to enable logging

// NOTE: Only testing functionality that is not inherited from the base class, or that overrides base class functionality

describe('ConditioningLogRepository', () => {
	let adapter: ManagedStatefulFsPersistenceAdapter<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>;
	let repo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				// ConfigModule is imported automatically by createTestingModule
				{ // ManagedStatefulFsPersistenceAdapter
					provide: ManagedStatefulFsPersistenceAdapter,
					useValue: new PersistenceAdapterMock<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>('test-conditioning-logs')
				},
				{ // Repository throttling time
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				},
				ConditioningLogRepository,
			]
		}))
		.compile();

		adapter = module.get<ManagedStatefulFsPersistenceAdapter<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>>(ManagedStatefulFsPersistenceAdapter);
		repo = module.get<ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>>(ConditioningLogRepository);
	});

	let randomIndex: number;
	let randomDTO: ConditioningLogDTO;
	let randomPersistenceDTO: ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>;
	let testDTOs: ConditioningLogDTO[];
	let testPersistenceDTOs: ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>[];
	beforeEach(() => {
		testDTOs = <ConditioningLogDTO[]>[
			{
				entityId: uuidv4(),
				meta: {
					sourceId: {
						source: DeviceType.SUUNTO_T6,
						id: "20000806-090329"
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
			},
			{
				entityId: uuidv4(),
				meta: {
				  sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20010806-090329"
				  }
				},
				isOverview: false,
				start: "2021-01-01T07:00:00.000Z",
				end: "2021-01-01T07:30:00.000Z",
				activity: ActivityType.RUN,
				activityOrder: 0,
				duration: { value: 1800000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Morning run",
				sensorLogs: [
				  {
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data: [
					  { timeStamp: "2021-01-01T07:00:00.000Z", value: { value: 10, unit: "m" } },
					  { timeStamp: "2021-01-01T07:10:00.000Z", value: { value: 15, unit: "m" } },
					  { timeStamp: "2021-01-01T07:20:00.000Z", value: { value: 20, unit: "m" } }
					]
				  },
				  {
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
					  { timeStamp: "2021-01-01T07:05:00.000Z", value: { value: 120, unit: "bpm" } },
					  { timeStamp: "2021-01-01T07:15:00.000Z", value: { value: 130, unit: "bpm" } },
					  { timeStamp: "2021-01-01T07:25:00.000Z", value: { value: 140, unit: "bpm" } }
					]
				  },
				  {
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data: [
					  { timeStamp: "2021-01-01T07:10:00.000Z", value: { value: 10, unit: "km/h" } },
					  { timeStamp: "2021-01-01T07:20:00.000Z", value: { value: 12, unit: "km/h" } },
					  { timeStamp: "2021-01-01T07:30:00.000Z", value: { value: 14, unit: "km/h" } }
					]
				  }
				]
			},
			{
				entityId: uuidv4(),
				meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20020807-090329"
				}
				},
				isOverview: false,
				start: "2021-02-01T08:00:00.000Z",
				end: "2021-02-01T08:45:00.000Z",
				activity: ActivityType.SWIM,
				activityOrder: 0,
				duration: { value: 2700000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Swimming session",
				sensorLogs: [
				{
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data: [
					{ timeStamp: "2021-02-01T08:00:00.000Z", value: { value: 5, unit: "m" } },
					{ timeStamp: "2021-02-01T08:15:00.000Z", value: { value: 7, unit: "m" } },
					{ timeStamp: "2021-02-01T08:30:00.000Z", value: { value: 6, unit: "m" } }
					]
				},
				{
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
					{ timeStamp: "2021-02-01T08:10:00.000Z", value: { value: 110, unit: "bpm" } },
					{ timeStamp: "2021-02-01T08:25:00.000Z", value: { value: 115, unit: "bpm" } },
					{ timeStamp: "2021-02-01T08:40:00.000Z", value: { value: 120, unit: "bpm" } }
					]
				},
				{
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data: [
					{ timeStamp: "2021-02-01T08:15:00.000Z", value: { value: 2, unit: "km/h" } },
					{ timeStamp: "2021-02-01T08:30:00.000Z", value: { value: 2.5, unit: "km/h" } },
					{ timeStamp: "2021-02-01T08:45:00.000Z", value: { value: 3, unit: "km/h" } }
					]
				}
				]
			},
			{
				entityId: uuidv4(),
				meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20030808-090329"
				}
				},
				isOverview: false,
				start: "2021-03-01T09:00:00.000Z",
				end: "2021-03-01T09:30:00.000Z",
				activity: ActivityType.BIKE,
				activityOrder: 0,
				duration: { value: 1800000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Bike ride",
				sensorLogs: [
				{
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data: [
					{ timeStamp: "2021-03-01T09:00:00.000Z", value: { value: 12, unit: "m" } },
					{ timeStamp: "2021-03-01T09:15:00.000Z", value: { value: 14, unit: "m" } },
					{ timeStamp: "2021-03-01T09:30:00.000Z", value: { value: 16, unit: "m" } }
					]
				},
				{
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
					{ timeStamp: "2021-03-01T09:05:00.000Z", value: { value: 100, unit: "bpm" } },
					{ timeStamp: "2021-03-01T09:20:00.000Z", value: { value: 105, unit: "bpm" } },
					{ timeStamp: "2021-03-01T09:25:00.000Z", value: { value: 110, unit: "bpm" } }
					]
				},
				{
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data: [
					{ timeStamp: "2021-03-01T09:10:00.000Z", value: { value: 20, unit: "km/h" } },
					{ timeStamp: "2021-03-01T09:20:00.000Z", value: { value: 22, unit: "km/h" } },
					{ timeStamp: "2021-03-01T09:30:00.000Z", value: { value: 24, unit: "km/h" } }
					]
				}
				]
			},
			{
				entityId: uuidv4(),
				meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20040809-090329"
				}
				},
				isOverview: false,
				start: "2021-04-01T10:00:00.000Z",
				end: "2021-04-01T10:45:00.000Z",
				activity: ActivityType.RUN,
				activityOrder: 0,
				duration: { value: 2700000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Afternoon run",
				sensorLogs: [
				{
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data: [
					{ timeStamp: "2021-04-01T10:00:00.000Z", value: { value: 8, unit: "m" } },
					{ timeStamp: "2021-04-01T10:15:00.000Z", value: { value: 10, unit: "m" } },
					{ timeStamp: "2021-04-01T10:30:00.000Z", value: { value: 12, unit: "m" } }
					]
				},
				{
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
					{ timeStamp: "2021-04-01T10:05:00.000Z", value: { value: 115, unit: "bpm" } },
					{ timeStamp: "2021-04-01T10:20:00.000Z", value: { value: 120, unit: "bpm" } },
					{ timeStamp: "2021-04-01T10:35:00.000Z", value: { value: 125, unit: "bpm" } }
					]
				},
				{
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data: [
					{ timeStamp: "2021-04-01T10:10:00.000Z", value: { value: 11, unit: "km/h" } },
					{ timeStamp: "2021-04-01T10:25:00.000Z", value: { value: 12, unit: "km/h" } },
					{ timeStamp: "2021-04-01T10:40:00.000Z", value: { value: 13, unit: "km/h" } }
					]
				}
				]
			},
			{
				entityId: uuidv4(),
				meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20050810-090329"
				}
				},
				isOverview: false,
				start: "2021-05-01T11:00:00.000Z",
				end: "2021-05-01T11:30:00.000Z",
				activity: ActivityType.SWIM,
				activityOrder: 0,
				duration: { value: 1800000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Swimming practice",
				sensorLogs: [
				{
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data: [
					{ timeStamp: "2021-05-01T11:00:00.000Z", value: { value: 6, unit: "m" } },
					{ timeStamp: "2021-05-01T11:15:00.000Z", value: { value: 8, unit: "m" } },
					{ timeStamp: "2021-05-01T11:30:00.000Z", value: { value: 7, unit: "m" } }
					]
				},
				{
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
					{ timeStamp: "2021-05-01T11:05:00.000Z", value: { value: 105, unit: "bpm" } },
					{ timeStamp: "2021-05-01T11:20:00.000Z", value: { value: 110, unit: "bpm" } },
					{ timeStamp: "2021-05-01T11:25:00.000Z", value: { value: 115, unit: "bpm" } }
					]
				},
				{
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data: [
					{ timeStamp: "2021-05-01T11:10:00.000Z", value: { value: 1.5, unit: "km/h" } },
					{ timeStamp: "2021-05-01T11:20:00.000Z", value: { value: 2, unit: "km/h" } },
					{ timeStamp: "2021-05-01T11:30:00.000Z", value: { value: 2.5, unit: "km/h" } }
					]
				}
				]
			},
			{
				entityId: uuidv4(),
				meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20060811-090329"
				}
				},
				isOverview: false,
				start: "2021-06-01T12:00:00.000Z",
				end: "2021-06-01T12:30:00.000Z",
				activity: ActivityType.BIKE,
				activityOrder: 0,
				duration: { value: 1800000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Cycling session",
				sensorLogs: [
				{
					sensorType: SensorType.ALTITUDE,
					unit: "m",
					data: [
					{ timeStamp: "2021-06-01T12:00:00.000Z", value: { value: 15, unit: "m" } },
					{ timeStamp: "2021-06-01T12:15:00.000Z", value: { value: 18, unit: "m" } },
					{ timeStamp: "2021-06-01T12:30:00.000Z", value: { value: 20, unit: "m" } }
					]
				},
				{
					sensorType: SensorType.HEARTRATE,
					unit: "bpm",
					data: [
					{ timeStamp: "2021-06-01T12:05:00.000Z", value: { value: 110, unit: "bpm" } },
					{ timeStamp: "2021-06-01T12:20:00.000Z", value: { value: 115, unit: "bpm" } },
					{ timeStamp: "2021-06-01T12:25:00.000Z", value: { value: 120, unit: "bpm" } }
					]
				},
				{
					sensorType: SensorType.SPEED,
					unit: "km/h",
					data: [
					{ timeStamp: "2021-06-01T12:10:00.000Z", value: { value: 25, unit: "km/h" } },
					{ timeStamp: "2021-06-01T12:20:00.000Z", value: { value: 27, unit: "km/h" } },
					{ timeStamp: "2021-06-01T12:30:00.000Z", value: { value: 30, unit: "km/h" } }
					]
				}
				]
			},
			{
				entityId: uuidv4(),
				meta: {
				sourceId: {
					source: DeviceType.SUUNTO_T6,
					id: "20070812-090329"
				}
				},
				isOverview: false,
				start: "2021-07-01T13:00:00.000Z",
				end: "2021-07-01T13:30:00.000Z",
				activity: ActivityType.RUN,
				activityOrder: 0,
				duration: { value: 1800000, unit: "ms" },
				className: "ConditioningLog",
				activities: [],
				laps: [],
				note: "Evening run",
				sensorLogs: [
					{
						sensorType: SensorType.ALTITUDE,
						unit: "m",
						data: [
						{ timeStamp: "2021-07-01T13:00:00.000Z", value: { value: 10, unit: "m" } },
						{ timeStamp: "2021-07-01T13:15:00.000Z", value: { value: 12, unit: "m" } },
						{ timeStamp: "2021-07-01T13:30:00.000Z", value: { value: 14, unit: "m" } }
						]
					},
					{
						sensorType: SensorType.HEARTRATE,
						unit: "bpm",
						data: [
						{ timeStamp: "2021-07-01T13:05:00.000Z", value: { value: 120, unit: "bpm" } },
						{ timeStamp: "2021-07-01T13:20:00.000Z", value: { value: 125, unit: "bpm" } },
						{ timeStamp: "2021-07-01T13:25:00.000Z", value: { value: 130, unit: "bpm" } }
						]
					},
					{
						sensorType: SensorType.SPEED,
						unit: "km/h",
						data: [
						{ timeStamp: "2021-07-01T13:10:00.000Z", value: { value: 10, unit: "km/h" } },
						{ timeStamp: "2021-07-01T13:20:00.000Z", value: { value: 12, unit: "km/h" } },
						{ timeStamp: "2021-07-01T13:30:00.000Z", value: { value: 14, unit: "km/h" } }
						]
					}
				]
			}
		];

		testPersistenceDTOs = testDTOs.map(dto => {
			const createdOn = new Date();
			const updatedOn = new Date(createdOn.getTime() + Math.floor(Math.random() * 1000));
			return {
				createdOn: createdOn.toISOString(),
				updatedOn: updatedOn.toISOString(),
				...dto,				
				} as ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>;
			});

		randomIndex = Math.floor(Math.random() * testDTOs.length);
		randomDTO = testDTOs[randomIndex];
		randomPersistenceDTO = testPersistenceDTOs[randomIndex];
	});
	
	let adapterInitSpy: jest.SpyInstance;
	let adapterShutdownSpy: jest.SpyInstance;
	let consoleLogSpy: jest.SpyInstance;
	let fetchAllSpy: jest.SpyInstance;
	let fetchByIdSpy: jest.SpyInstance;
	beforeEach(() => {
		adapterInitSpy = jest.spyOn(repo['adapter'], 'initialize').mockResolvedValue(Promise.resolve(Result.ok()));
		adapterShutdownSpy = jest.spyOn(repo['adapter'], 'shutdown').mockResolvedValue(Promise.resolve(Result.ok()));
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // suppress console.log output in tests
		fetchAllSpy = jest.spyOn(adapter, 'fetchAll').mockResolvedValue(Promise.resolve(Result.ok(testPersistenceDTOs)));
		fetchByIdSpy = jest.spyOn(adapter, 'fetchById').mockResolvedValue(Promise.resolve(Result.ok(randomPersistenceDTO)));
	});	

	afterEach(() => {
		fetchAllSpy?.mockRestore();
		fetchByIdSpy?.mockRestore();
		adapterInitSpy?.mockRestore();
		consoleLogSpy?.mockRestore();
		jest.clearAllMocks();
	});

	describe('Component Lifecycle', () => {
		// NOTE: Repository is fully tested in the base class, so only the User specific methods are tested here.
		// Also testing that the lifecycle method calls are effectively routed to the base clase by the mixin.		

		it('can be created', () => {
			expect(repo).toBeDefined();
			expect(repo).toBeInstanceOf(ConditioningLogRepository);
		});

		describe('Initialization', () => {
			it('can be initialized', async () => {
				// arrange
				// act/assert
				expect(async () => await repo.initialize()).not.toThrow(); // just check that it doesn't throw
			});

			it('initializes cache with a collection of overview logs from persistence', async () => {			
				const fetchAllResult = await repo.fetchAll(); // implicitly calls isReady()
				expect(fetchAllResult.isSuccess).toBeTruthy();
				const logs$ = fetchAllResult.value as Observable<ConditioningLog<any, ConditioningLogDTO>[]>;
				const logs = await firstValueFrom(logs$);
				expect(logs).toHaveLength(testDTOs.length);
				logs.forEach((log, index) => {
					expect(log).toBeInstanceOf(ConditioningLog);
					const dto = testDTOs.find(dto => dto.entityId === log.entityId);
					expect(dto).toBeDefined();
					expect(log.entityId).toBe(dto!.entityId);
					expect(log.isOverview).toBe(true);
				});
			});
		});
	
		describe('Shutdown', () => {
				it('can be shut down', async () => {
					// arrange
					await repo.initialize(); // initialize the repo
					
					// act/assert
					expect(async () => await repo.shutdown()).not.toThrow(); // just check that it doesn't throw
				});			
	
				

			it('unsubscribes from all observables and clears subscriptions', async () => {
				// arrange
				await repo.initialize(); // initialize the repo
				const dummySubscription = new Observable((subscriber) => {
					subscriber.next('dummy');
					subscriber.complete();
				});
				repo['subscriptions'].push(dummySubscription.subscribe());
				expect(repo['subscriptions'].length).toBe(2); // base repo already added one subscription (id cache to main cache)
				
				// act
				await repo.shutdown();
	
				// assert
				expect(repo['subscriptions'].length).toBe(0); // all subscriptions should be cleared
			});
		});	
	});

	describe('Data API', () => {
		// NOTE: Repository methods are fully tested in the base class, so only testing fetchById here
		// to sample that the base class methods are called correctly.

		describe('fetchById', () => {
			it('fetches a conditioning log by ID', async () => {				
				// arrange
				await repo.initialize(); // initialize the repo to set up the adapter and fetch all logs
				// act
				const fetchResult = await repo.fetchById(randomDTO.entityId!);
				
				// assert
				expect(fetchResult.isSuccess).toBeTruthy();
				const log$ = fetchResult.value as Observable<ConditioningLog<any, ConditioningLogDTO>>;
				const log = await firstValueFrom(log$.pipe(take(1)));
				expect(log).toBeDefined();
				expect(log).toBeInstanceOf(ConditioningLog);
				expect(log!.entityId).toBe(randomDTO.entityId);
			});
		});
	});

	describe('Management API', () => {
		// NOTE: no need to fully retest ManagedStatefulComponentMixin methods,
			// as they are already tested in the mixin.
			// Just do a few checks that things are hooked up correctly,
			// and that local implementations work correctly.			
					
		describe('ManagedStatefulComponentMixin Members', () => {
			it('Inherits componentState$ ', () => {
				expect(repo).toHaveProperty('componentState$');
				expect(repo.componentState$).toBeDefined();
				expect(repo.componentState$).toBeInstanceOf(Observable);
			});

			it('Inherits initialize method', () => {
				expect(repo).toHaveProperty('initialize');
				expect(repo.initialize).toBeDefined();
				expect(repo.initialize).toBeInstanceOf(Function);
			});

			it('Inherits shutdown method', () => {
				expect(repo).toHaveProperty('shutdown');
				expect(repo.shutdown).toBeDefined();
				expect(repo.shutdown).toBeInstanceOf(Function);
			});

			it('Inherits isReady method', () => {
				expect(repo).toHaveProperty('isReady');
				expect(repo.isReady).toBeDefined();
				expect(repo.isReady).toBeInstanceOf(Function);
			});

			it('inherits registerSubcomponent method', () => {
				expect(repo).toHaveProperty('registerSubcomponent');
				expect(repo.registerSubcomponent).toBeDefined();
				expect(repo.registerSubcomponent).toBeInstanceOf(Function);
			});

			it('inherits unregisterSubcomponent method', () => {
				expect(repo).toHaveProperty('unregisterSubcomponent');
				expect(repo.unregisterSubcomponent).toBeDefined();
				expect(repo.unregisterSubcomponent).toBeInstanceOf(Function);
			});
		});

		describe('State Transitions', () => {
			it('is in UNINITIALIZED state before initialization', async () => {
				// arrange
				const stateInfo = await firstValueFrom(repo.componentState$.pipe(take (1))) as ComponentStateInfo; // get the initial state

				// act
				
				// assert
				expect(stateInfo).toBeDefined();
				expect(stateInfo.state).toBe(ComponentState.UNINITIALIZED);
			});

			it('is in OK state after initialization', async () => {
				// arrange				
				await repo['adapter'].updateState({ // mock the adapter state update
					name: 'PersistenceAdapterMock',
					state: ComponentState.OK,
					reason: 'Test initialization',
					updatedOn: new Date()
				});

				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = repo.componentState$.subscribe((s) => {
					state = s.state;
				});

				expect(state).toBe(ComponentState.UNINITIALIZED); // sanity check

				// act
				await repo.initialize();

				// assert
				expect(state).toBe(ComponentState.OK);

				// clean up
				sub.unsubscribe();
			});

			it('is in SHUT_DOWN state after shutdown', async () => {
				// arrange
				let state: ComponentState = 'TESTSTATE' as ComponentState; // assign a dummy value to avoid TS error
				const sub = repo.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				await repo['adapter'].updateState({ // mock the adapter state update
					name: 'PersistenceAdapterMock',
					state: ComponentState.OK,
					reason: 'Test initialization',
					updatedOn: new Date()
				});	
				await repo.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check

				await repo['adapter'].updateState({ // mock the adapter state update
					name: 'PersistenceAdapterMock',
					state: ComponentState.SHUT_DOWN,
					reason: 'Test initialization',
					updatedOn: new Date()
				});	
				
				
				// act
				await repo.shutdown();

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
				const sub = repo.componentState$.subscribe((s: ComponentStateInfo) => {
					state = s.state;
				});
				expect(state).toBe(ComponentState.UNINITIALIZED);// sanity check
				
				const onInitializeSpy = jest.spyOn(repo, 'onInitialize').mockReturnValue(Promise.resolve());
	
				// act
				await repo.initialize();
				expect(state).toBe(ComponentState.OK); // sanity check
	
				// assert
				expect(onInitializeSpy).toHaveBeenCalledTimes(1);
				expect(onInitializeSpy).toHaveBeenCalledWith(expect.objectContaining({ isSuccess: true }));

				// clean up
				sub.unsubscribe();
				onInitializeSpy.mockRestore();
			});
		});

		describe('isReady', () => {		
			it('reports if/when it is initialized (i.e. ready)', async () => {
				// arrange
				await repo['adapter'].updateState({ // mock the adapter state update
					name: 'PersistenceAdapterMock',
					state: ComponentState.OK,
					reason: 'Test initialization',
					updatedOn: new Date()
				});	
				
				await repo.initialize(); // initialize the repo

				// act
				const result = await repo.isReady();

				// assert
				expect(result).toBe(true);
			});
		});		

		describe('shutdown', () => {
			it('calls onShutdown', async () => {				
				// arrange
				const onShutdownSpy = jest.spyOn(repo, 'onShutdown').mockReturnValue(Promise.resolve());
				await repo.initialize(); // initialize the repo
				
				// act
				await repo.shutdown();
	
				// assert
				expect(onShutdownSpy).toHaveBeenCalledTimes(1);
				expect(onShutdownSpy).toHaveBeenCalledWith(expect.objectContaining({ isSuccess: true }));

				// clean up
				onShutdownSpy.mockRestore();
			});
		});
	});

	describe('Template Method Implementations', () => {
		describe('getClassFromDTO', () => {
			it('returns a reference to a known the class from the DTO', async () => {
				const dto = testPersistenceDTOs[randomIndex];
				const result = repo['getClassFromDTO'](dto);
				expect(result.isSuccess).toBeTruthy();
				expect(result.value).toBe(ConditioningLog);
			});

			it('returns a failure result for an unknown class', async () => {
				const dto = testPersistenceDTOs[randomIndex];
				dto.className = 'UnknownClass';
				const result = repo['getClassFromDTO'](dto);
				expect(result.isFailure).toBeTruthy();
			});
		});
	});

	describe('Protected Method Overrides', () => {
		describe('createEntityCreatedEvent', () => {
			it('returns a ConditioningLogCreatedEvent', async () => {
				// arrange
				const createResult = ConditioningLog.create({...randomDTO, entityId: uuidv4()});
				const log = createResult.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// act
				const event = repo['createEntityCreatedEvent'](log);

				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('ConditioningLogCreatedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual(log.toDTO());
			});
		});

		describe('createEntityUpdatedEvent', () => {
			it('returns a ConditioningLogUpdatedEvent', async () => {
				// arrange
				const createResult = ConditioningLog.create({...randomDTO, entityId: uuidv4()});
				const log = createResult.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// act
				const event = repo['createEntityUpdatedEvent'](log);

				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('ConditioningLogUpdatedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual(log.toDTO());
			});			
		});

		describe('createEntityDeletedEvent', () => {
			it('returns a ConditioningLogDeletedEvent', async () => {
				// arrange
				const createResult = ConditioningLog.create({...randomDTO, entityId: uuidv4()});
				const log = createResult.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// act
				const event = repo['createEntityDeletedEvent'](log.entityId);

				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('ConditioningLogDeletedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual({ entityId: log.entityId, className: 'ConditioningLog' });
			});
		});

		describe('createEntityUndeletedEvent', () => {
			it('returns a ConditioningLogUndeletedEvent', async () => {
				// arrange
				const createResult = ConditioningLog.create({...randomDTO, entityId: uuidv4()});
				const log = createResult.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// act
				const event = repo['createEntityUndeletedEvent'](log.entityId!, new Date());

				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('ConditioningLogUndeletedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual({ entityId: log.entityId, className: 'ConditioningLog' });
			});
		});

		describe('getEntityFromDTO', () => {
			beforeEach(async () => {
				await repo.initialize(); // initialize the repo
			});

			it('returns an entity from the cache by ID', async () => {
				const entity = repo['getEntityFromDTO'](randomDTO);
				expect(entity).toBeDefined();
				expect(entity!.entityId).toBe(randomDTO.entityId);
			});

			it('returns an entity from the cache by source metadata, if find by id fails', async () => {
				const originalId = randomDTO.entityId;
				randomDTO.entityId = 'invalid id';
				const entity = repo['getEntityFromDTO'](randomDTO);
				expect(entity).toBeDefined();
				expect(entity!.entityId).toBe(originalId);
			});
		});
	});
});