import { TestingModule } from '@nestjs/testing';

import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom, Observable, take } from 'rxjs';

import { ConsoleLogger, Logger } from "@evelbulgroz/logger";
import { PersistenceAdapter, Result } from '@evelbulgroz/ddd-base';

import { createTestingModule } from '../../test/test-utils';
import { User } from '../domain/user.entity';
import { UserDTO } from '../dtos/user.dto';
import { UserRepository } from './user.repo';
import { UserPersistenceDTO } from '../dtos/user-persistence.dto';

class PersistenceAdapterMock<T extends UserPersistenceDTO> extends PersistenceAdapter<T> {
	// cannot get generics to work with jest.fn(), so skipping for now
	public initialize = jest.fn();
	public shutdown = jest.fn();
	public create = jest.fn();
	public update = jest.fn();
	public delete = jest.fn();
	public fetchById = jest.fn();
	public fetchAll = jest.fn();
	public undelete = jest.fn();
}

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

describe('UserRepo', () => {
	let adapter: PersistenceAdapter<UserPersistenceDTO>;
	let repo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				// ConfigModule is imported automatically by createTestingModule
				{
					provide: PersistenceAdapter,
					useClass: PersistenceAdapterMock,
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
				{
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				},
				UserRepository,
			]
		}))
		.compile();

		adapter = module.get<PersistenceAdapter<UserPersistenceDTO>>(PersistenceAdapter);
		repo = module.get<UserRepository>(UserRepository);
	});

	let randomIndex: number;
	let randomDTO: UserDTO;
	let testDTOs: UserDTO[];
	let testPersistenceDTOs: UserPersistenceDTO[];
	beforeEach(() => {
		testDTOs = [
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
		];

		const now = Date.now();

		testPersistenceDTOs = testDTOs.map(dto => ({
			...dto,
			createdOn: new Date(now).toISOString(),
			updatedOn: new Date(now + 1000).toISOString(),
		}));
		
		randomIndex = Math.floor(Math.random() * testDTOs.length);
		randomDTO = testDTOs[randomIndex];		
	});
		
	let adapterDeleteSpy: jest.SpyInstance;
	let adapterFetchAllSpy: jest.SpyInstance;
	let adapterFetchByQuerySpy: jest.SpyInstance;
	let adapterInitSpy: jest.SpyInstance;
	beforeEach(() => {
		adapterDeleteSpy = jest.spyOn(adapter, 'delete').mockResolvedValue(Promise.resolve(Result.ok()));
		adapterFetchAllSpy = jest.spyOn(adapter, 'fetchAll').mockResolvedValue(Promise.resolve(Result.ok(testPersistenceDTOs)));
		adapterInitSpy = jest.spyOn(adapter, 'initialize').mockResolvedValue(Promise.resolve(Result.ok()));		
	});

	beforeEach(async () => {
		await repo.initialize();
	});

	afterEach(() => {
		adapterDeleteSpy?.mockRestore();
		adapterFetchAllSpy?.mockRestore();
		adapterInitSpy?.mockRestore();
		jest.clearAllMocks();
	});
	
	it('can be created', () => {
		expect(repo).toBeDefined();
		expect(repo).toBeInstanceOf(UserRepository);
	});

	describe('Data API', () => {
		// NOTE: Repository methods are fully tested in the base class, so only the User specific methods are tested here,
		// as well as a single test for fetchAll to sample that the base class methods are called correctly.

		describe('fetchAll', () => {
			it('can fetch all', async () => {
				// arrange
				// act
				const result = await repo.fetchAll();
				
				// assert
				expect(adapterFetchAllSpy).toHaveBeenCalledTimes(1);
				expect(adapterInitSpy).toHaveBeenCalledTimes(1);		
				expect(result.isSuccess).toBe(true);
				
				const users$ = result.value as unknown as Observable<User[]>;
				const users = await firstValueFrom(users$);
				expect(users.map(u => u.toDTO())).toEqual(testDTOs);
			});
		});

		describe('fetchByUserId', () => {
			// NOTE: fetchByQuery is fully tested in the base class, so testing the basics here

			it('can fetch a user by user id', async () => {
				// arrange
				const userId = randomDTO.userId;
				
				// act
				const result = await repo.fetchByUserId(userId);
				
				// assert
				expect(result.isSuccess).toBe(true);
				const users$ = result.value as unknown as Observable<User[]>;
				const users = await firstValueFrom(users$);
				expect(users.length).toBe(1);
				expect(users[0].toDTO()).toEqual(randomDTO);
			});

			it('returns empty array if user id is unknown', async () => {
				// arrange
				const userId = uuidv4();
				
				// act
				const result = await repo.fetchByUserId(userId);
				
				// assert
				expect(result.isSuccess).toBe(true);
				const users$ = result.value as unknown as Observable<User[]>;
				const users = await firstValueFrom(users$);
				expect(users.length).toBe(0);
			});

			it('by default does not include deleted users', async () => {
				// arrange
				const cachedUser = repo['retrieveCacheEntry'](randomDTO.entityId!) as User; // get reference to entity in cache, so we can modify it
				cachedUser['_updatedOn'] = undefined; // clear updatedOn to avoid conflict with soft delete, circumventing setter validation
				const deleteResult = await repo.delete(randomDTO.entityId!, true); // soft delete the user
				expect(deleteResult.isSuccess).toBe(true); // sanity check
				
				// act
				const fetchResult = await repo.fetchByUserId(cachedUser.userId);
				
				// assert
				expect(fetchResult.isSuccess).toBe(true);
				const users$ = fetchResult.value as unknown as Observable<User[]>;
				const users = await firstValueFrom(users$);
				expect(users.length).toBe(0);
			});

			xit('optionally can include deleted users', async () => {
				// arrange
				const cachedUser = repo['retrieveCacheEntry'](randomDTO.entityId!) as User; // get reference to entity in cache, so we can modify it
				cachedUser['_updatedOn'] = undefined; // clear updatedOn to avoid conflict with soft delete, circumventing setter validation
				const deleteResult = await repo.delete(randomDTO.entityId!, true); // soft delete the user
				expect(deleteResult.isSuccess).toBe(true); // sanity check
				
				// act
				const result = await repo.fetchByUserId(cachedUser.userId, true);
				
				// assert
				expect(result.isSuccess).toBe(true);
				const users$ = result.value as unknown as Observable<User[]>;
				const users = await firstValueFrom(users$);
				expect(users.length).toBe(1);
				expect(users[0].toDTO()).toEqual(randomDTO);
			});
		});

		describe('getClassFromName', () => {
			it('can get class from known name', () => {
				// arrange
				const className = 'User';
				
				// act
				const result = UserRepository.getClassFromName(className);
				
				// assert
				expect(result.isSuccess).toBe(true);
				expect(result.value).toBe(User);
			});

			it('wraps return value in a Result', () => {
				// arrange
				const className = 'User';
				
				// act
				const result = UserRepository.getClassFromName(className);
				
				// assert
				expect(result).toBeInstanceOf(Result);
			});
			
			it('returns failure if class name is unknown', () => {
				// arrange
				const className = 'Unknown';
				
				// act
				const result = UserRepository.getClassFromName(className);
				
				// assert
				expect(result.isFailure).toBe(true);
				expect(result.error).toBe(`Unknown or unsupported user type: ${className}`);
			});
		});
	});

	describe('Management API', () => {
			// NOTE: no need to retest either Repository or ManagedStatefulComponentMixin methods, as they are already tested in the base class.
			// Just do a few checks that things are hooked up correctly.
			describe('initialize', () => {
				it('initializes cache with a collection of overview logs from persistence', async () => {			
					const fetchAllResult = await repo.fetchAll(); // implicitly calls isReady()
					expect(fetchAllResult.isSuccess).toBeTruthy();
					const logs$ = fetchAllResult.value as Observable<User[]>;
					const logs = await firstValueFrom(logs$);
					expect(logs).toHaveLength(testDTOs.length);
					logs.forEach((log, index) => {
						expect(log).toBeInstanceOf(User);
						const dto = testDTOs.find(dto => dto.entityId === log.entityId);
						expect(dto).toBeDefined();
						expect(log.entityId).toBe(dto!.entityId);
					});
				});
			});
	
			describe('isReady', () => {
				it('returns true if the repository is ready', async () => {
					const result = await repo.isReady();
					expect(result).toBeTruthy();
				});
			});
	
			describe('shutdown', () => {
				it('shuts down the repository', async () => {
				  // Clear any existing mocks
				  jest.clearAllMocks();
				  
				  // Setup the spy directly on the mock's method that already exists
				  const shutdownSpy = jest.spyOn(adapter, 'shutdown')
					.mockResolvedValue(Result.ok());
				  
				  // Perform the shutdown
				  await repo.shutdown();
				  
				  // Assertions
				  expect(repo['cache'].value.length).toBe(0);
				  expect(shutdownSpy).toHaveBeenCalledTimes(1);
				});
			  });
		});

	describe('Template Method Implementations', () => {
		describe('getClassFromDTO', () => {
			it('can get class from known DTO', () => {
				// arrange
				const dto = randomDTO;
				
				// act
				const result = repo['getClassFromDTO'](dto);
				
				// assert
				expect(result.isSuccess).toBe(true);
				expect(result.value).toBe(User);
			});

			it('wraps return value in a Result', () => {
				// arrange
				const dto = randomDTO;
				
				// act
				const result = repo['getClassFromDTO'](dto);
				
				// assert
				expect(result).toBeInstanceOf(Result);
			});
			
			it('returns failure if DTO class name is unknown', () => {
				// arrange
				const dto = { ...randomDTO, className: 'Unknown' };
				
				// act
				const result = repo['getClassFromDTO'](dto);
				
				// assert
				expect(result.isFailure).toBe(true);
				expect(result.error).toBe(`Unknown or unsupported user type: ${dto.className}`);
			});
		});
	});

	describe('Protected Method Overrides', () => {
		describe('createEntityCreatedEvent', () => {
			it('returns a UserCreatedEvent', () => {
				// arrange
				const createResult = User.create(randomDTO);
				expect(createResult.isSuccess).toBe(true);
				const user = createResult.value as unknown as User;
				
				// act
				const event = repo['createEntityCreatedEvent'](user);
				
				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('UserCreatedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual(user.toDTO());
			});
		});

		describe('createEntityUpdatedEvent', () => {
			it('returns a UserUpdatedEvent', () => {
				// arrange
				const createResult = User.create(randomDTO);
				expect(createResult.isSuccess).toBe(true);
				const user = createResult.value as unknown as User;
				
				// act
				const event = repo['createEntityUpdatedEvent'](user);
				
				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('UserUpdatedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual(user.toDTO());
			});
		});

		describe('createEntityDeletedEvent', () => {
			it('returns a UserDeletedEvent', () => {
				// arrange
				const createResult = User.create(randomDTO);
				expect(createResult.isSuccess).toBe(true);
				const user = createResult.value as unknown as User;
				
				// act
				const event = repo['createEntityDeletedEvent'](user.userId);
				
				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('UserDeletedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual({ entityId: user.userId, className: 'User' });
			});
		});

		describe('createEntityUndeletedEvent', () => {
			it('returns a UserUndeletedEvent', () => {
				// arrange
				const createResult = User.create(randomDTO);
				expect(createResult.isSuccess).toBe(true);
				const user = createResult.value as unknown as User;
				
				// act
				const event = repo['createEntityUndeletedEvent'](user.userId, new Date());
				
				// assert
				expect(event).toBeDefined();
				expect(event.eventId).toBeDefined();
				expect(event.eventName).toBe('UserUndeletedEvent');
				expect(event.occurredOn).toBeDefined();
				expect(event.payload).toEqual({ entityId: user.userId, className: 'User' });
			});
		});
	});
});