import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { of, Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { ConsoleLogger, Logger, Result } from '@evelbulgroz/ddd-base';

import { createTestingModule } from '../../test/test-utils';
import { EntityIdDTO } from '../../dtos/sanitization/entity-id.dto';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../domain/user-context.model';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user.repo';
import { UserService } from './user.service';


describe('UserService', () => {
	// set up test environment and dependencies/mocks, and initialize the module
	let app: TestingModule;
	let config: ConfigService;
	let service: UserService;
	let userRepo: UserRepository;
	let userRepoUpdatesSubject: Subject<any>;
	beforeEach(async () => {
		userRepoUpdatesSubject = new Subject<any>();				

		app = await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				ConfigService,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},
				{
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				},
				{
					provide: UserRepository,
					useValue: {
						isReady: jest.fn(),
						create: jest.fn(),
						fetchByQuery: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						undelete: jest.fn(),
						updates$: userRepoUpdatesSubject.asObservable(),
					}
				},
				UserService
			],
		});

		config = app.get<ConfigService>(ConfigService);
		service = app.get<UserService>(UserService);
		userRepo = app.get<UserRepository>(UserRepository);
	});

	// set up test data
	let randomDTO: UserDTO;
	let randomIndex: number;
	let randomUser: User;
	let randomUserId: EntityIdDTO;
	let userContext: UserContext;
	let userDTOs: UserDTO[];
	beforeEach(() => {
		userDTOs = [
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
		];

		randomIndex = Math.floor(Math.random() * userDTOs.length);
		randomDTO = userDTOs[randomIndex];
		randomUser = User.create(randomDTO).value as unknown as User;
		randomUserId = new EntityIdDTO(randomDTO.userId);

		userContext = new UserContext({
			userId: randomUser.userId,
			userName: config.get<any>('security.collaborators.user.serviceName'), // display name for user, or service name if user is a service account (subName from JWTPayload)
			userType: 'service', // 'service' or 'user'
			roles: ['admin'], // roles assigned to the user
		});
	});

	// set up spies
	let userRepoCreateSpy: jest.SpyInstance;
	let userRepoDeleteSpy: jest.SpyInstance;
	let userRepoFetchByQuerySpy: jest.SpyInstance;
	let userRepoIsReadySpy: jest.SpyInstance;
	let userRepoUndeleteSpy: jest.SpyInstance;
	beforeEach(() => {
		userRepoCreateSpy = jest.spyOn(userRepo, 'create').mockReturnValue(Promise.resolve(Result.ok(randomUser)));
		userRepoDeleteSpy = jest.spyOn(userRepo, 'delete').mockImplementation((entityId, softDelete) => {
			void entityId; // suppress unused variable warning
			if (softDelete) {
				randomUser.deletedOn = new Date(randomUser.createdOn!.getTime() + 1000); // soft delete
			}
			else {
				randomUser = undefined as unknown as User; // hard delete
			}
			return Promise.resolve(Result.ok())		
		});
		userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([randomUser]))));
		userRepoIsReadySpy = jest.spyOn(userRepo, 'isReady').mockReturnValue(Promise.resolve(Result.ok(true)));
		userRepoUndeleteSpy = jest.spyOn(userRepo, 'undelete').mockImplementation(() => {
			randomUser.deletedOn = undefined; // undelete
			return Promise.resolve(Result.ok());
		});
	});

	// tear down test environment
	afterEach(async () => {
		userRepoCreateSpy && userRepoCreateSpy.mockRestore();
		userRepoDeleteSpy && userRepoDeleteSpy.mockRestore();
		userRepoFetchByQuerySpy && userRepoFetchByQuerySpy.mockRestore();
		userRepoIsReadySpy && userRepoIsReadySpy.mockRestore();
		jest.clearAllMocks();
		await app.close();
	});

	it('can be created', () => {
		expect(service).toBeDefined();
	});

	describe('Public API', () => {
		describe('isReady', () => {		
			it('reports if/when it is initialized (i.e. ready)', async () => {
				// arrange
				userRepoIsReadySpy.mockRestore();
				userRepoIsReadySpy = jest.spyOn(userRepo, 'isReady').mockReturnValue(Promise.resolve(Result.ok(false)));

				// act
				const result = await service.isReady();

				// assert
				expect(result).toBe(false);
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});
		});
		
		describe('create()', () => {
			let newUserIdDTO: EntityIdDTO;
			let newUser: User;
			beforeEach(() => {
				newUserIdDTO = new EntityIdDTO(uuidv4());
				newUser = User.create({entityId: uuidv4(), userId: newUserIdDTO.value, logs: [], className: 'User' }).value as unknown as User;
				
				userRepoCreateSpy.mockRestore();
				userRepoCreateSpy = jest.spyOn(userRepo, 'create').mockReturnValue(Promise.resolve(Result.ok(newUser)));				
			});

			it('initializes the service', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));
				
				// act
				const result = await service.create(userContext, newUserIdDTO);

				// assert
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});

			it('can create a new User entity', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = await service.create(userContext, newUserIdDTO);

				// assert
				expect(userRepoCreateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: newUserIdDTO.value }));
				expect(userRepoFetchByQuerySpy).toHaveBeenCalledTimes(1);
				
				expect(result).toEqual(newUser.entityId);
			});

			it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: 'invalid',
					userType: 'service',
					roles: ['admin'],
				});

				// act
				const result = service.create(invalidContext, newUserIdDTO);

				// assert
				await expect(result).rejects.toThrow('User invalid not authorized to access UserService.createUser');
			});

			it('throws error if caller is not admin', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: config.get<any>('security.collaborators.user.serviceName'),
					userType: 'service',
					roles: ['invalid'],
				});

				// act
				const result = service.create(invalidContext, newUserIdDTO);

				// assert
				await expect(result).rejects.toThrow('User fitnessapp-user-service not authorized to access UserService.createUser');
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				randomUserId['_value'] = null as unknown as string;
				
				// act
				const result = service.create(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow("UserService.createUser requires a valid user id, got: null");
			});

			it('throws error if user with same microservice user id already exists', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([newUser]))));

				// act
				const result = service.create(userContext, newUserIdDTO);

				// assert
				await expect(result).rejects.toThrow(/already exists/);
			});
		});
		
		describe('delete()', () => {
			it('initializes the service', async () => {
				// arrange
				
				// act
				const result = await service.delete(userContext, randomUserId);

				// assert
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});

			it('can delete a User entity by its user id in the user microservice', async () => {
				// arrange
				
				// act
				const result = await service.delete(userContext, randomUserId);

				// assert
				expect(result).toBeUndefined();
				expect(userRepoDeleteSpy).toHaveBeenCalledTimes(1);
			});

			it('by default soft deletes the user entity', async () => {
				// arrange
				expect(randomUser.deletedOn).not.toBeDefined(); // sanity check
				
				// act
				const result = await service.delete(userContext, randomUserId);

				// assert
				expect(userRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).toBeDefined();
			});

			it('succeeds with no change if user exists and is already soft deleted', async () => {
				// arrange
				const originalDeletedOn = new Date(randomUser.createdOn!.getTime() + 1000);
				randomUser.deletedOn = originalDeletedOn;
				
				// act
				const result = await service.delete(userContext, randomUserId, true);

				// assert
				expect(userRepoDeleteSpy).not.toHaveBeenCalled();
				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).toEqual(originalDeletedOn);
			});

			it('optionally hard deletes the user entity', async () => {
				// arrange
				const originalEntityId = randomUser.entityId;		
				
				// act
				const result = await service.delete(userContext, randomUserId, false);

				// assert
				expect(userRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(userRepoDeleteSpy).toHaveBeenCalledWith(originalEntityId, false);
				expect(result).toBeUndefined();
				expect(randomUser).not.toBeDefined();
			});

			it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: 'invalid',
					userType: 'service',
					roles: ['admin'],
				});

				// act
				const result = service.delete(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User invalid not authorized to access UserService.delete');
			});

			it('throws error if caller is not admin', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: config.get<any>('security.collaborators.user.serviceName'),
					userType: 'service',
					roles: ['invalid'],
				});

				// act
				const result = service.delete(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User fitnessapp-user-service not authorized to access UserService.delete');
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				randomUserId['_value'] = null as unknown as string;
				
				// act
				const result = service.delete(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow("UserService.delete requires a valid user id, got: null");
			});

			it('throws error if user does not exist', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = service.delete(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow(/does not exist/);
			});
		});	
		
		describe('undelete()', () => {
			it('initializes the service', async () => {
				// arrange
				
				// act
				const result = await service.undelete(userContext, randomUserId);

				// assert
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});

			it('can undelete a User entity by its user id in the user microservice', async () => {
				// arrange
				randomUser.deletedOn = new Date(randomUser.createdOn!.getTime() + 1000);
				
				// act
				const result = await service.undelete(userContext, randomUserId);

				// assert
				expect(userRepoUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUndeleteSpy).toHaveBeenCalledWith(randomUser.entityId);

				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).not.toBeDefined();
			});

			it('succeeds with no change if user exists and is not soft deleted', async () => {
				// arrange
				randomUser.deletedOn = undefined; // sanity check
				
				// act
				const result = await service.undelete(userContext, randomUserId);

				// assert
				expect(userRepoUndeleteSpy).not.toHaveBeenCalled();
				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).not.toBeDefined();
			});

			it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: 'invalid',
					userType: 'service',
					roles: ['admin'],
				});

				// act
				const result = service.undelete(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User invalid not authorized to access UserService.undelete');
			});

			it('throws error if caller is not admin', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: config.get<any>('security.collaborators.user.serviceName'),
					userType: 'service',
					roles: ['invalid'],
				});

				// act
				const result = service.undelete(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User fitnessapp-user-service not authorized to access UserService.undelete');
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				randomUserId['_value'] = null as unknown as string;
				
				// act
				const result = service.undelete(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow("UserService.undelete requires a valid user id, got: null");
			});

			it('throws error if user does not exist', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = service.undelete(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow(/does not exist/);
			});
		});
	});

	describe('Protected Methods', () => {
		describe('checkIsValidCaller()', () => {  }); // todo: implement tests
		describe('checkIsValidId()', () => {  }); // todo: implement tests
		describe('findUserByMicroserviceId', () => {}); // todo: implement tests
		describe('getUniqueUser()', () => {}); // todo: implement tests
	});
});
