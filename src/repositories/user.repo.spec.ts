import { TestingModule } from '@nestjs/testing';

import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom, Observable } from 'rxjs';

import { ConsoleLogger, Logger, PersistenceAdapter, Result } from '@evelbulgroz/ddd-base';

import { createTestingModule } from '../test/test-utils';
import { User } from '../domain/user.entity';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from './user.repo';
import { UserPersistenceDTO } from '../dtos/domain/user-persistence.dto';

class PersistenceAdapterMock<T extends UserPersistenceDTO> extends PersistenceAdapter<T> {
	// cannot get generics to work with jest.fn(), so skipping for now
	public initialize = jest.fn();
	public create = jest.fn();
	public update = jest.fn();
	public delete = jest.fn();
	public fetchById = jest.fn();
	public fetchAll = jest.fn();
	public undelete = jest.fn();
}

describe('UserRepo', () => {
	let adapter: PersistenceAdapter<UserPersistenceDTO>;
	let repo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
		providers: [
			// ConfigModule is imported automatically by createTestingModule
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
			UserRepository,
		],
		});

		adapter = module.get<PersistenceAdapter<UserPersistenceDTO>>(PersistenceAdapter);
		repo = module.get<UserRepository>(UserRepository);
	});

	let randomIndex: number;
	let randomDTO: UserDTO;
	let testDTOs: UserDTO[];
	let testPersistenceDTOs: UserPersistenceDTO[];
	beforeEach(() => {
		testDTOs = [
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
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
		
	let fetchAllSpy: jest.SpyInstance;
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
		expect(repo).toBeInstanceOf(UserRepository);
	});

	describe('Public API', () => {
		// NOTE: Repository methods are fully tested in the base class, so only the User specific methods are tested here,
		// as well as a single test for fetchAll to sample that the base class methods are called correctly.

		describe('fetchAll', () => {
			it('can fetch all', async () => {
				// arrange
				// act
				const result = await repo.fetchAll();
				
				// assert
				expect(fetchAllSpy).toHaveBeenCalledTimes(1);
				expect(initSpy).toHaveBeenCalledTimes(1);		
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