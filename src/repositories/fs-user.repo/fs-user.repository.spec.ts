import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { jest }  from '@jest/globals';
import { HttpModule, HttpService } from '@nestjs/axios';

//import { of } from 'rxjs';
import {v4 as uuidv4} from 'uuid';

import { EventSourceBuilder } from '../../utils/event-source-builder';
import { User } from '../../domain/user.entity';
import { UserDTO } from "../../dtos/domain/user.dto";
import { ConsoleLogger, Logger, Result } from '@evelbulgroz/ddd-base';
import { createTestingModule } from '../../test/test-utils';
import { FileService } from '../../services/file-service/file.service';
import { FsUserRepo } from './fs-user.repository';

const originalTimeout = 5000;
//jest.setTimeout(15000); // accomodate slow dev machine/connection
//process.env.NODE_ENV = 'untest'; // ConsoleLogger will not log in test environment

describe('FsUserRepo', () => {
	// general setup	
	let config: ConfigService;
	let fs: FileService;
	let httpService: HttpService
	let repo: FsUserRepo;
	let testDTO: UserDTO;
	
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			//ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule
			],
			providers: [
				ConfigService,
				FileService,
				FsUserRepo,
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
		repo = module.get<FsUserRepo>(FsUserRepo);
		fs = module.get<FileService>(FileService);
		httpService = module.get<HttpService>(HttpService);		
			
		testDTO = <UserDTO>{ // include all optional fields to facilitate equality checks
			entityId: uuidv4(),
			className: "User",
			userId: uuidv4(),
			logs: [uuidv4(), uuidv4()],
		};
	});

	// mock initialization:
	// suppress/mock all interactions with file system and import service during initialization
	// override mocks in individual tests as needed	
	let consoleSpy: any;
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
		
		readdirSpy = jest.spyOn(fs, 'readdir').mockImplementation((path) => {
			// mock reading data directory
			return Promise.resolve([ 'user1.json', 'user2.json' ] as any);
		});

		readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation((filePath) => {
			// mock reading user from file system
			const dto = {...testDTO, entityId: uuidv4()};
			return Promise.resolve(JSON.stringify(dto));
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
	});

	afterEach(() => {
		// restore any and all mocks (release spies from memory)
		consoleSpy && consoleSpy.mockRestore();
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
		it('initializes user cache', async () => {
			// arrange
			
			// act
			const result = await repo.isReady(); // wait for repo to initialize
			
			// assert
			expect(result).toBeDefined();
			expect(result.isSuccess).toBe(true); // sanity check

			expect((<any>repo).cache.value.length).toBe(2); // two users should be in cache
			const user = (<any>repo).cache.value[0];
			expect(user).toBeInstanceOf(User);
			expect(user.entityId).toBeDefined();
			expect(user.userId).toBe(testDTO.userId);
		});

		it('initializes id cache', async () => {
			// arrange			
			
			// act
			const result = await repo.isReady(); // wait for repo to initialize
			
			// assert
			expect(result).toBeDefined();
			expect(result.isSuccess).toBe(true); // sanity check

			const userCache = (<any>repo).cache.value;
			const idCache = (<any>repo).idCache.value; idCache.sort();
			expect(idCache.length).toBe(2); // two log ids should be in idCache
			expect(idCache).toEqual(userCache.map((user: User) => user.entityId).sort());
		});
		
		it('updates id cache when main log cache is updated', async () => {
			// arrange
			const result = await (<any>repo).initialize();
			let cache = (<any>repo).cache.value;
			let idCache = (<any>repo).idCache.value;
			expect(idCache.length).toBe(2); // sanity check
				
			// act
			const newUser = User.create(testDTO, uuidv4(), undefined, undefined).value as User;
			(<any>repo).cache.next([...cache, newUser]); // add log to cache
			
			cache = (<any>repo).cache.value; cache.sort();
			idCache = (<any>repo).idCache.value; idCache.sort();
			
			// assert
			expect(result).toBeDefined();
			expect(result.isSuccess).toBe(true);
			expect(cache.length).toBe(3); // cache should have three entries
			expect(idCache.length).toBe(3); // idCache should have three entries
			expect(idCache).toEqual(cache.map((user: User) => user.entityId).sort());
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
		xit('subscribes to updates from import microservice', async () => {
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
			it('can create a user from a dto', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id);
				const user = result.value as User;
				
				// assert
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(user).toBeDefined();
				expect(user).toBeInstanceOf(User);
				expect(user.entityId).toBe(id);
			});

			it('writes a dto to the file system', async () => {
				// arrange
				const dto = testDTO;
				const id = uuidv4();
				
				// act
				const result = await (<any>repo).createEntity(dto, id);
				const log = result.value as User;
				
				// assert
				expect(writeFileSpy).toHaveBeenCalledWith(`${(<any>repo).dataDir}/${id}.json`, JSON.stringify(log));
			});

			// it('updates log cache', async () => {}); // covered by base class tests
			
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
				
				// act
				const result = await (<any>repo).createEntity(testDTO, {entityId: 'invalid id'});
				
				// assert
				expect(result).toBeDefined();
				expect(result.isFailure).toBe(true);
				expect(result.error).toBeDefined();
				expect(writeFileSpy).not.toHaveBeenCalled();
			});
		});

		describe('retrieve', () => {
			it('can retrieve a user from persistence by id', async () => {
				// arrange
				
				// act
				const result = await (<any>repo).retrieveEntity(testDTO.entityId!, true);
				const user = result.value as User;
				
				// assert				
				expect(readFileSpy).toHaveBeenNthCalledWith(3, `${(<any>repo).dataDir}/${testDTO.entityId}.json`);
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(user).toBeDefined();
				expect(user).toBeInstanceOf(User);
				expect(user.entityId).toBeDefined();
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
			it('can store a user to persistence', async () => {
				// arrange
				const id = uuidv4();
				const user = User.create(testDTO, id).value as User;
				
				// act
				const result = await (<any>repo).updateEntity(user);
				
				// assert
				expect(result).toBeDefined();
				expect(result.isSuccess).toBe(true);
				expect(result.value).toBeUndefined();
				expect(mkdirSpy).toHaveBeenCalledTimes(2);
				expect(writeFileSpy).toHaveBeenCalledTimes(1);
				expect(writeFileSpy).toHaveBeenCalledWith(`${(<any>repo).dataDir}/${id}.json`, JSON.stringify(user));
			});

			it('wraps return in a result', async () => {
				// arrange
				const id = uuidv4();
				const user = User.create(testDTO, id).value as User;
				
				// act
				const result = await (<any>repo).updateEntity(user);
				
				// assert
				expect(result).toBeDefined();
				expect(result).toBeInstanceOf(Result);
			});

			it('returns a failure if storage fails', async () => {
				// arrange
				const id = uuidv4();
				const user = User.create(testDTO, id).value as User;
				
				writeFileSpy.mockRestore(); // restore writeFile to allow failure
				writeFileSpy = jest.spyOn(fs, 'writeFile')
					.mockImplementation(() => {
						return Promise.reject('writeFile failed');
					}
				);
				
				// act
				const result = await (<any>repo).updateEntity(user);
				
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


			it('can delete a user by id', async () => {
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
