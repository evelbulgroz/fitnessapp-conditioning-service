import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { jest }  from '@jest/globals';
import { HttpModule, HttpService } from '@nestjs/axios';

import { of } from 'rxjs';
import {v4 as uuidv4} from 'uuid';

//import { EventSourceBuilder } from '../../utils/event-source-builder.js';
import { ActivityType, DeviceType, SensorType } from '@evelbulgroz/fitnessapp-base';
import { ConsoleLogger, Logger, Result } from '@evelbulgroz/ddd-base';

import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from "../../dtos/domain/conditioning-log.dto";
import { createTestingModule } from '../../test/test-utils';
import { FileService } from '../../services/file-service/file.service';
import { FsConditioningLogRepo } from './fs-conditioning-log.repo';

const originalTimeout = 5000;
//jest.setTimeout(15000); // accomodate slow dev machine/connection
//process.env.NODE_ENV = 'untest'; // ConsoleLogger will not log in test environment

/*
class EventSourceMock {
	CLOSED = 2;
	CONNECTING = 0;
	OPEN = 0;

	readyState = 0;
	url = '';
	withCredentials: false;

	constructor(url: string, options?: any) {
		this.url = url;
		this.readyState = this.CONNECTING;

		// Emit open event after a delay
		const timer = setTimeout(() => {
			if (this.onopen) {
				this.onopen({} as MessageEvent);
				this.readyState = this.OPEN;
			}

			//if (this.onmessage) { this.onmessage({ data: 'mock data' } as MessageEvent); 	}
			
			clearTimeout(timer);			
		}, 0);
	}	
	
	dispatchEvent(event: Event): boolean {return false;	};
	
	onopen: ((event: MessageEvent<any>) => any);
	onmessage: ((event: MessageEvent<any>) => any);
	onerror: ((event: MessageEvent<any>) => any);
	
	addEventListener(type: any, listener: any, options?: boolean | any): void {};
	
	close(): void {};
	
	removeEventListener(type: any, listener: any, options?: boolean | any): void {}
}
*/

describe('FsConditioningLogRepo', () => {
	// general setup	
	let config: ConfigService;
	let fs: FileService;
	let httpService: HttpService
	let repo: FsConditioningLogRepo;
	let testDTO: ConditioningLogDTO;
	
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			//ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule
			],
			providers: [
				ConfigService,
				FileService,
				FsConditioningLogRepo,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},
				{
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				}
			],
		});

		config = module.get<ConfigService>(ConfigService);
		repo = module.get<FsConditioningLogRepo>(FsConditioningLogRepo);
		fs = module.get<FileService>(FileService);
		httpService = module.get<HttpService>(HttpService);		
			
		testDTO = <ConditioningLogDTO>{ // include all optional fields to facilitate equality checks
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
	});

	// mock initialization:
	// suppress/mock all interactions with file system and import service during initialization
	// override mocks in individual tests as needed	
	let consoleSpy: any;
	let eventSourceSpy: any;
	let httpGetSpy: any;
	let httpPostSpy: any;
	let mkdirSpy: any;
	let readFileSpy: any;
	let readdirSpy: any;
	let statSpy: any;
	let writeFileSpy: any;
	
	beforeEach(async () => {
		//consoleSpy = jest.spyOn(console, 'log').mockImplementation(msg => { expect(msg).toBeDefined(); }); // supress console.log
		
		mkdirSpy = jest.spyOn(fs, 'mkdir').mockImplementation(() => {
			// supress data dir creation
			return Promise.resolve();
		});
		
		readdirSpy = jest.spyOn(fs, 'readdir')
			.mockImplementationOnce((path) => {
				// first run: return empty 'files' array to trigger loading conditioning logs from import service
				return Promise.resolve([]);
			})
			.mockImplementationOnce((path) => {
				// second run: return array with two suunto files to trigger loading dtos from files
				return Promise.resolve(['20200806-090329.json', '20200806-090329.json']);
			})
			.mockImplementation((path) => {
				// third run: return array with two dtos to populate cache
				return Promise.resolve([`${testDTO.entityId}.json`, `${testDTO.entityId}.json`]);
			})
			.mockImplementation((path) => {
				// fourth run: mock import service reading conditioning logs when finalizing initialization
				return Promise.resolve([`${testDTO.entityId}.json`, `${testDTO.entityId}.json`]);
			});

		readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation((filePath) => {
			// mock reading conditioning log from file system
			return Promise.resolve(JSON.stringify(testDTO));
		});
		
		statSpy = jest.spyOn(fs, 'stat').mockImplementation((path) => {
			const isDirectory = path.endsWith('.json') ? false : true;
			return Promise.resolve({ isDirectory: () => isDirectory });
			}
		);

		writeFileSpy = jest.spyOn(fs, 'writeFile').mockImplementation((path, data) => {
			// supress write to file system
			return Promise.resolve();
		});

		/*
		eventSourceSpy = jest.spyOn(EventSourceBuilder, 'EventSource').mockImplementation((url: string, options?: any) => {
			return new EventSourceMock(url, options); // mock EventSource
		});
		*/

		httpGetSpy = jest.spyOn(httpService, 'get').mockImplementation((url: string, config?: any) => {
			const dateTimeRegex = /^\d{8}-\d{6}$/; // regex to match 'YYYYMMDD-HHMMSS' date-time string
			if (url.endsWith('serviceregistry')) { // service registry
				return of({data: 'http://localhost:3010/registry'}) as any;
			}
			else if (url.endsWith('fitnessapp-import-service')) { // import service
				return of({data: 
					{
						"id": "939ee67f-a68c-410b-88d1-d13c144f67f9",
						"name": "fitnessapp-conditioning-service",
						"location": "http://localhost:3001"
					}
				}) as any;
			}
			else if (url.endsWith('conditioning/logs')) { // all logs
				const dto1 = {...testDTO};
				dto1.entityId = uuidv4();
				dto1.isOverview = true;
				
				const dto2 = {...testDTO};
				dto2.entityId = uuidv4();
				dto2.isOverview = true;

				return of({data: [dto1, dto2]});
			}
			/* single log uses post, not get
			else if (url.split('/').pop()?.match(dateTimeRegex)) { // single log
				console.debug(`mocking http get for ${url}`);
				testDTO.entityId = uuidv4(); // change entityId to avoid duplicate key error
				testDTO.isOverview = false;
				return of({data: testDTO});
			}
			*/
			else if (url.endsWith('conditioning/updates')) { // updates
				return of({data: []});
			}
			else {
				console.log(`unknown url: ${url}`);
				return of({data: `unknown url: ${url}`}) as any;
			}
		});

		httpPostSpy = jest.spyOn(httpService, 'post').mockImplementation((url: string, data: any, config?: any) => {
			if (url.endsWith('conditioning/log')) { // single log
				testDTO.entityId = uuidv4(); // change entityId to avoid duplicate key error
				testDTO.isOverview = false;
				return of({data: testDTO});
			}
			else {
				console.log(`unknown url: ${url}`);
				return of({data: `unknown url: ${url}`}) as any;
			}
		});
	});

	afterEach(() => {
		// restore any and all mocks (release spies from memory)
		consoleSpy && consoleSpy.mockRestore();
		eventSourceSpy && eventSourceSpy.mockRestore();
		httpGetSpy && httpGetSpy.mockRestore();
		mkdirSpy && mkdirSpy.mockRestore();
		readdirSpy && readdirSpy.mockRestore();
		readFileSpy && readFileSpy.mockRestore();
		statSpy && statSpy.mockRestore();
		writeFileSpy && writeFileSpy.mockRestore();
		
		jest.clearAllMocks(); // seems ineffective, doing it anyway
	});

	afterAll(() => {
		jest.setTimeout(originalTimeout); // reset timeout to default (not sure if necessary)
	});

	it('can be created', () => {
		expect(repo).toBeDefined();
	});

	describe('initialization', () => {
		it('initializes log cache with overviews', async () => {
			// arrange
			
			// act
			const result = await repo.isReady(); // wait for repo to initialize
			
			// assert
			expect(result).toBeDefined();
			expect(result.isSuccess).toBe(true); // sanity check

			expect((<any>repo).cache.value.length).toBe(2); // two logs should be in cache
			expect((<any>repo).cache.value[0]).toBeInstanceOf(ConditioningLog);
			expect((<any>repo).cache.value[0].entityId).toBe(testDTO.entityId);
			expect((<any>repo).cache.value[0].isOverview).toBe(true);
		});

		it('initializes id cache', async () => {
			// arrange			
			
			// act
			const result = await repo.isReady(); // wait for repo to initialize
			
			// assert
			expect(result).toBeDefined();
			expect(result.isSuccess).toBe(true); // sanity check

			expect((<any>repo).idCache.value.length).toBe(2); // two log ids should be in idCache
			expect((<any>repo).idCache.value[0]).toBe(testDTO.entityId);
		});
		
		it('updates id cache when main log cache is updated', async () => {
			// arrange
			const result = await (<any>repo).initialize();
			expect((<any>repo).idCache.value.length).toBe(2); // sanity check
				
			// act
			const log = ConditioningLog.create(testDTO, uuidv4(), undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
			(<any>repo).cache.next([...(<any>repo).cache.value, log]); // add log to cache
			
			// assert
			expect(result).toBeDefined();
			expect(result.isSuccess).toBe(true);
			expect((<any>repo).idCache.value.length).toBe(3); // idCache should have three entries		
		});
		
		it('returns a failure if initialization fails', async () => {
			// arrange
			repo['initialize'] = () => Promise.resolve(Result.fail('initialize failed'));

			// act
			const result = await repo.isReady(); // wait for repo to initialize
			
			// assert
			expect(result).toBeDefined();
			expect(result.isFailure).toBe(true);
			expect(result.error).toBeDefined();
		});
		
		/*
		it('subscribes to updates from import microservice', async () => {
			// todo: test that repo processes updates from import microservice correctly
			// arrange
			expect(repo['importUpdateSource']).toBeUndefined(); // sanity check
			
			// act
			const result = await repo.isReady(); // wait for repo to initialize
			
			// assert
			expect(repo['importUpdateSource']).toBeDefined();
		});
		*/
	});

	describe('CRUD', () => {
		/** NOTE: These tests are not exhaustive, as the base class provides most of the public CRUD functionality.
		 * This test suite only tests the internal helper methods that enable that functionality for this repo.
		 * Interactions with the persistence layer are captured by mocks, and calls to the mocks are asserted.
		 */
		
		beforeEach(async () => {
			await repo.isReady(); // wait for repo to initialize
		});

		describe('create', () => {
			it('can create a conditioning log from a dto', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(log).toBeDefined();
				expect(log).toBeInstanceOf(ConditioningLog);
				expect(log.entityId).toBe(id);
			});

			it('writes a dto to the file system', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert
				expect(writeFileSpy).toHaveBeenCalledWith(`${(<any>repo).dataDir}/${id}.json`, JSON.stringify(log));
			});

			// it('updates log cache', async () => {}); // covered by base class tests
			
			it('by default creates a detailed conditioning log', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id, false);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(log).toBeDefined();
				expect(log).toBeInstanceOf(ConditioningLog);
				expect(log.entityId).toBe(id);
				expect(log.isOverview).toBe(false);
			});

			it('can create an overview conditioning log by request', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id, true);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(log).toBeDefined();
				expect(log).toBeInstanceOf(ConditioningLog);
				expect(log.entityId).toBe(id);
				expect(log.isOverview).toBe(true);
			});

			it('wraps return in a Result', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id);
				
				// assert
				expect(result).toBeDefined();
				expect(result).toBeInstanceOf(Result);
			});

			it('returns a failure if creation fails', async () => {
				// arrange
				delete testDTO.meta; // remove required field to force failure
				
				// act
				const result = await (<any>repo).createEntity(testDTO, uuidv4);
				
				// assert
				expect(result).toBeDefined();
				expect(result.isFailure).toBe(true);
				expect(result.error).toBeDefined();
				expect(writeFileSpy).toHaveBeenCalled();
			});
		});

		describe('retrieve', () => {
			it('can retrieve a conditioning log from persistence by id', async () => {
				// arrange
				
				// act
				const result = await (<any>repo).retrieveEntity(testDTO.entityId!, true);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert				
				expect(readFileSpy).toHaveBeenNthCalledWith(3, `${(<any>repo).dataDir}/${testDTO.entityId}.json`);
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(log).toBeDefined();
				expect(log).toBeInstanceOf(ConditioningLog);
				expect(log.entityId).toBe(testDTO.entityId);
			});

			it('by default retrieves an overview log', async () => {
				// arrange
				
				// act
				const result = await (<any>repo).retrieveEntity(testDTO.entityId!);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert				
				expect(log.isOverview).toBe(true);
			});

			it('can retrieve a detailed log by request', async () => {
				// arrange
				
				// act
				const result = await (<any>repo).retrieveEntity(testDTO.entityId!, false);
				const log = result.value as ConditioningLog<any, ConditioningLogDTO>;
				
				// assert				
				expect(log.isOverview).toBe(false);
			});

			it('wraps return in a Result', async () => {
				// arrange
				
				// act
				const result = await (<any>repo).retrieveEntity(testDTO.entityId!, true);
				
				// assert				
				expect(result).toBeDefined();
				expect(result).toBeInstanceOf(Result);
			});

			it('returns a failure if retrieval fails', async () => {
				// arrange
				readFileSpy.mockRestore(); // restore readFile to allow failure
				readFileSpy = jest.spyOn(fs, 'readFile')
					.mockImplementation(() => {
						return Promise.reject('readFile failed');
					}
				);
				
				// act
				const result = await (<any>repo).retrieveEntity(testDTO.entityId!, true);
				
				// assert				
				expect(result).toBeDefined();
				expect(result.isFailure).toBe(true);
				expect(result.error).toBeDefined();
				expect(readFileSpy).toHaveBeenCalled();
			});
		});
		
		describe('update', () => {
			it('can store a conditioning log to persistence', async () => {
				// arrange
				const id = uuidv4();
				const testLog = ConditioningLog.create(testDTO, id, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				// act
				const result = await (<any>repo).updateEntity(testLog);
				
				// assert
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(result.value).toBeUndefined();
				expect(mkdirSpy).toHaveBeenCalledTimes(2);
				expect(writeFileSpy).toHaveBeenCalledTimes(5);
			});

			it('wraps return in a result', async () => {
				// arrange
				const id = uuidv4();
				const testLog = ConditioningLog.create(testDTO, id, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				// act
				const result = await (<any>repo).updateEntity(testLog);
				
				// assert
				expect(result).toBeDefined();
				expect(result).toBeInstanceOf(Result);
			});

			it('returns a failure if storage fails', async () => {
				// arrange
				const id = uuidv4();
				const testLog = ConditioningLog.create(testDTO, id, undefined, undefined, false).value as ConditioningLog<any, ConditioningLogDTO>;
				
				writeFileSpy.mockRestore(); // restore writeFile to allow failure
				writeFileSpy = jest.spyOn(fs, 'writeFile')
					.mockImplementation(() => {
						return Promise.reject('writeFile failed');
					}
				);
				
				// act
				const result = await (<any>repo).updateEntity(testLog);
				
				// assert
				expect(result).toBeDefined();
				expect(result.isFailure).toBe(true);
				expect(result.error).toBeDefined();
				expect(writeFileSpy).toHaveBeenCalledTimes(1);
			});
		});
		
		describe('delete', () => {
			let rmSpy: any;

			beforeEach(async () => {
				rmSpy = jest.spyOn(fs, 'rm')
					.mockImplementation(path => {
						return Promise.resolve();
					});
			});

			afterEach(() => {
				rmSpy && rmSpy.mockRestore();
			});


			it('can delete a conditioning log by id', async () => {
				// arrange
				const id = uuidv4();			
				
				// act
				const result = await (<any>repo).deleteEntity(id);
				
				// assert
				expect(rmSpy).toHaveBeenCalledTimes(1);
				expect(rmSpy).toHaveBeenCalledWith(`${(<any>repo).dataDir}/${id}.json`);
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(result.value).toBeUndefined();
			});

			it('wraps return in a Result', async () => {
				// arrange
				const id = uuidv4();			
				
				// act
				const result = await (<any>repo).deleteEntity(id);
				
				// assert
				expect(result).toBeDefined();
				expect(result).toBeInstanceOf(Result);
			});

			it('returns a failure result if deletion fails', async () => {			
				// arrange
				const id = uuidv4();			
				
				rmSpy.mockRestore(); // restore rm to allow failure
				rmSpy = jest.spyOn(fs, 'rm')
					.mockImplementation(path => {
						expect(path).toBe(`${(<any>repo).dataDir}/${id}.json`);
						return Promise.reject('delete failed');
					});

				// act
				const result = await (<any>repo).deleteEntity(id);
				
				// assert
				expect(rmSpy).toHaveBeenCalled();
				expect(result).toBeDefined();
				expect(result.isFailure).toBe(true);
			});
		});
	});
});
