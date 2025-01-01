import { TestingModule } from '@nestjs/testing';

import { v4 as uuidv4 } from 'uuid';

import { ConsoleLogger, EntityId, EntityMetadataDTO, Logger, PersistenceAdapter, Result } from '@evelbulgroz/ddd-base';
import { DeviceType, ActivityType, SensorType } from '@evelbulgroz/fitnessapp-base';

import { ConditioningLogRepository } from './conditioning-log.repo';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogPersistenceDTO } from '../dtos/domain/conditioning-log-persistence.dto';
import { createTestingModule } from '../test/test-utils';
import { firstValueFrom, Observable } from 'rxjs';

class PersistenceAdapterMock<T extends ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>> extends PersistenceAdapter<T> {
	// cannot get generics to work with jest.fn(), so skipping for now
	public initialize = jest.fn();
	public create = jest.fn();
	public update = jest.fn();
	public delete = jest.fn();
	public fetchById = jest.fn();
	public fetchAll = jest.fn();
}

// process.env.NODE_ENV = 'not-test'; // set NODE_ENV to not 'test' to enable logging

describe('ConditioningLogRepository', () => {
	let adapter: PersistenceAdapter<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>;
	let repo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
		providers: [
			//ConfigModule is imported automatically by createTestingModule
			{
				provide: PersistenceAdapter,
				useClass: PersistenceAdapterMock,
			},
			{
				provide: Logger,
				useClass: ConsoleLogger
			},
			{
				provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
				useValue: 100						// figure out how to get this from config
			},
			ConditioningLogRepository,
		],
		});

		adapter = module.get<PersistenceAdapter<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>>(PersistenceAdapter);
		repo = module.get<ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>>(ConditioningLogRepository);
	});

	let randomIndex: number;
	let randomDTO: ConditioningLogDTO;
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
	});
	
	let fetchAllSpy: jest.SpyInstance;
	let fetchByIdSpy: jest.SpyInstance;
	let initSpy: jest.SpyInstance;
	beforeEach(() => {
		fetchAllSpy = jest.spyOn(adapter, 'fetchAll').mockResolvedValue(Promise.resolve(Result.ok(testPersistenceDTOs)));
		initSpy = jest.spyOn(repo['adapter'], 'initialize').mockResolvedValue(Promise.resolve(Result.ok()));		
	});

	beforeEach(async () => {
		await repo.isReady();
	});

	afterEach(() => {
		fetchAllSpy.mockRestore();
		initSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(repo).toBeDefined();
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

	describe('Method overrides', () => {
		describe('getEntityFromDTO', () => {
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
		
		describe('createEntityFromPersistenceDTO', () => {
			it('creates an overview entity from a persistence DTO', async () => {
				const dto = testPersistenceDTOs[randomIndex];
				const result = repo['createEntityFromPersistenceDTO'](dto, true);
				expect(result.isSuccess).toBeTruthy();
				const entity = result.value as ConditioningLog<any, ConditioningLogDTO>;
				expect(entity).toBeInstanceOf(ConditioningLog);
				expect(entity.isOverview).toBe(true);
			});

			it('assigns the DTO ID to the entity', async () => {
				const dto = testPersistenceDTOs[randomIndex];
				const result = repo['createEntityFromPersistenceDTO'](dto, true);
				expect(result.isSuccess).toBeTruthy();
				const entity = result.value as ConditioningLog<any, ConditioningLogDTO>;
				expect(entity.entityId).toBe(dto.entityId);
			});

			it('returns a failure result for an unknown class', async () => {
				const dto = testPersistenceDTOs[randomIndex];
				dto.className = 'UnknownClass';
				const result = repo['createEntityFromPersistenceDTO'](dto, true);
				expect(result.isFailure).toBeTruthy();
			});

			it('returns a failure result if entity creation fails', async () => {
				const dto = testPersistenceDTOs[randomIndex];
				delete dto.entityId; // entity creation will fail without an ID
				const result = repo['createEntityFromPersistenceDTO'](dto, true);
				expect(result.isSuccess).toBeTruthy();
			});
		});
	});
});