import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, of,  Subject, take } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {ComponentState, ComponentStateInfo} from "../../libraries/managed-stateful-component";
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { Query, SearchFilterOperation } from '@evelbulgroz/query-fns';
import { StreamLogger } from '../../libraries/stream-loggable';

import createTestingModule from '../../test/test-utils';
import PersistenceError from '../../shared/domain/persistence.error';
import UnauthorizedAccessError from '../../shared/domain/unauthorized-access.error';
import { User, UserDataService, UserDTO, UserRepository } from '..'; // shortcut import for all user-related modules


describe('UserDataService', () => {
	// set up test environment and dependencies/mocks, and initialize the module
	let app: TestingModule;
	let config: ConfigService;
	let service: UserDataService;
	let userRepo: UserRepository;
	let userRepoUpdatesSubject: Subject<any>;
	beforeEach(async () => {
		userRepoUpdatesSubject = new Subject<any>();				

		app = await (await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				ConfigService,
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
				UserDataService
			],
		}))
		.compile();

		config = app.get<ConfigService>(ConfigService);
		service = app.get<UserDataService>(UserDataService);
		userRepo = app.get<UserRepository>(UserRepository);
	});

	// set up test data
	let isAdmin: boolean;
	let randomDTO: UserDTO;
	let randomIndex: number;
	let randomUser: User;
	let randomUserId: EntityId;
	let requestingUserName: string;
	let softDelete: boolean;
	let userDTOs: UserDTO[];
	beforeEach(() => {
		isAdmin = true; // set to true to allow admin operations in tests

		userDTOs = [
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ entityId: uuidv4(), userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
		];

		randomIndex = Math.floor(Math.random() * userDTOs.length);
		randomDTO = userDTOs[randomIndex];
		randomUser = User.create(randomDTO).value as unknown as User;
		randomUserId = randomDTO.userId;

		requestingUserName = config.get<any>('security.collaborators.user.serviceName'); // use the service name as the requesting user name

		softDelete = true; // set to true to allow soft delete in tests
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

	describe('Data API', () => {
		describe('createUser', () => {
			let newUserId: EntityId;
			let newUser: User;
			beforeEach(() => {
				newUserId = uuidv4();
				newUser = User.create({entityId: uuidv4(), userId: newUserId, logs: [], className: 'User' }).value as unknown as User;
				
				userRepoCreateSpy.mockRestore();
				userRepoCreateSpy = jest.spyOn(userRepo, 'create')
					.mockReturnValue(Promise.resolve(Result.ok(newUser)));				
			});

			it('can create a new User entity', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = await service.createUser(requestingUserName, newUserId, isAdmin);

				// assert
				expect(userRepoCreateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: newUserId }));
				expect(userRepoFetchByQuerySpy).toHaveBeenCalledTimes(1);
				
				expect(result).toEqual(newUser.entityId);
			});

			it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidServiceName = 'invalid-requesting-service';
				
				// act
				const result = service.createUser(invalidServiceName, newUserId);

				// assert
				await expect(result).rejects.toThrow(`User ${invalidServiceName} not authorized to access UserDataService.createUser`);
			});

			it('throws error if caller is not admin', async () => {
				// arrange
				isAdmin = false; // set to false to simulate non-admin user
				// act
				const resultPromise = service.createUser(requestingUserName, newUserId, isAdmin);

				// assert
				await expect(resultPromise).rejects.toThrow('User fitnessapp-user-service not authorized to access UserDataService.createUser');
			});

			/* Note: Not sure whether/how to do this test, as any validated number or string is a valid user id
			it('throws error if user id is invalid', async () => {
				// arrange
				const invalidUserId = 'invalid-user-id'; // use an invalid user id

				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery')
					.mockReturnValue(Promise.resolve(Result.ok(of([])))); // simulate that user doesn't already exists
				
				// act
				const result = service.createUser(requestingUserName, invalidUserId, isAdmin);

				// assert
				await expect(result).rejects.toThrow(`UserDataService.createUser requires a valid user id, got: ${invalidUserId}`);

				expect(userRepoFetchByQuerySpy).toHaveBeenCalledTimes(1);
				expect(userRepoCreateSpy).not.toHaveBeenCalled();

				// clean up
				userRepoFetchByQuerySpy?.mockRestore();
			});
			*/

			it('throws error if user with same microservice user id already exists', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery')
					.mockReturnValue(Promise.resolve(Result.ok(of([newUser]))));

				// act
				const result = service.createUser(requestingUserName, newUserId, isAdmin);

				// assert
				await expect(result).rejects.toThrow(/already exists/);
			});
		});
		
		describe('deleteUser', () => {
			it('can delete a User entity by its user id in the user microservice', async () => {
				// arrange				
				// act
				const result = await service.deleteUser(requestingUserName, randomUserId, softDelete, isAdmin);

				// assert
				expect(result).toBeUndefined();
				expect(userRepoDeleteSpy).toHaveBeenCalledTimes(1);				
			});

			it('by default soft deletes the user entity', async () => {
				// arrange
				expect(randomUser.deletedOn).not.toBeDefined(); // sanity check
				
				// act
				const result = await service.deleteUser(requestingUserName, randomUserId, undefined, isAdmin);

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
				const result = await service.deleteUser(requestingUserName, randomUserId, softDelete, isAdmin);

				// assert
				expect(userRepoDeleteSpy).not.toHaveBeenCalled();
				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).toEqual(originalDeletedOn);
			});

			it('optionally hard deletes the user entity', async () => {
				// arrange
				const originalEntityId = randomUser.entityId;
				softDelete = false; // set to false to hard delete the user entity		
				
				// act
				const result = await service.deleteUser(requestingUserName, randomUserId, softDelete, isAdmin);

				// assert
				expect(userRepoDeleteSpy).toHaveBeenCalledTimes(1);
				expect(userRepoDeleteSpy).toHaveBeenCalledWith(originalEntityId, false);
				expect(result).toBeUndefined();
				expect(randomUser).not.toBeDefined();
			});

			it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidServiceName = 'invalid-requesting-service';

				// act
				const result = service.deleteUser(invalidServiceName, randomUserId, softDelete, isAdmin);

				// assert
				await expect(result).rejects.toThrow(`User ${invalidServiceName} not authorized to access UserDataService.delete`);
			});

			it('throws error if caller is not admin', async () => {
				// arrange
				isAdmin = false; // set to false to simulate non-admin user

				// act
				const result = service.deleteUser(requestingUserName, randomUserId, softDelete, isAdmin);

				// assert
				await expect(result).rejects.toThrow(`User ${requestingUserName} not authorized to access UserDataService.delete`);
			});

			it('throws error if user does not exist', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery')
					.mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = service.deleteUser(requestingUserName, randomUserId, softDelete, isAdmin);

				// assert
				await expect(result).rejects.toThrow(/does not exist/);
			});
		});
		
		describe('undeleteUser', () => {
			it('can undelete a User entity by its user id in the user microservice', async () => {
				// arrange
				randomUser.deletedOn = new Date(randomUser.createdOn!.getTime() + 1000);
				
				// act
				const result = await service.undeleteUser(requestingUserName, randomUserId, isAdmin);

				// assert
				expect(userRepoUndeleteSpy).toHaveBeenCalledTimes(1);
				expect(userRepoUndeleteSpy).toHaveBeenCalledWith(randomUser.entityId);

				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).not.toBeDefined();
			});

			it('succeeds with no change if user exists and is not soft deleted', async () => {
				// arrange
				randomUser.deletedOn = undefined; // ake sure user is not marked as soft deleted
				
				// act
				const result = await service.undeleteUser(requestingUserName, randomUserId, isAdmin);

				// assert
				expect(userRepoUndeleteSpy).not.toHaveBeenCalled();
				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).not.toBeDefined();
			});

			it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidServiceName = 'invalid-requesting-service';

				// act
				const result = service.undeleteUser(invalidServiceName, randomUserId, isAdmin);

				// assert
				await expect(result).rejects.toThrow(`User ${invalidServiceName} not authorized to access UserDataService.undeleteUser`);
			});

			it('throws error if caller is not admin', async () => {
				// arrange
				isAdmin = false; // set to false to simulate non-admin user

				// act
				const result = service.undeleteUser(requestingUserName, randomUserId, isAdmin);

				// assert
				await expect(result).rejects.toThrow(`User ${requestingUserName} not authorized to access UserDataService.undeleteUser`);
			});

			it('throws error if user does not exist', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery')
					.mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = service.undeleteUser(requestingUserName, randomUserId, isAdmin);

				// assert
				await expect(result).rejects.toThrow(/does not exist/);
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
				expect(service).toHaveProperty('componentState$');
				expect(service.componentState$).toBeDefined();
				expect(service.componentState$).toBeInstanceOf(Observable);
			});

			it('Inherits initialize method', () => {
				expect(service).toHaveProperty('initialize');
				expect(service.initialize).toBeDefined();
				expect(service.initialize).toBeInstanceOf(Function);
			});

			it('Inherits shutdown method', () => {
				expect(service).toHaveProperty('shutdown');
				expect(service.shutdown).toBeDefined();
				expect(service.shutdown).toBeInstanceOf(Function);
			});

			it('Inherits isReady method', () => {
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
				onInitializeSpy.mockRestore();
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
				onShutdownSpy.mockRestore();
			});

			it('unsubscribes from all observables and clears subscriptions', async () => {
				// arrange
				const dummySubscription = new Observable((subscriber) => {
					subscriber.next('dummy');
					subscriber.complete();
				});
				service['subscriptions'].push(dummySubscription.subscribe());
				expect(service['subscriptions'].length).toBe(1); // sanity check	
				
				await service.initialize(); // initialize the service
				
				// act
				await service.shutdown();
	
				// assert
				expect(service['subscriptions'].length).toBe(0); // all subscriptions should be cleared
			});
		});
	});

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

	describe('Protected Methods', () => {
		describe('checkIsValidCaller', () => {
			let callingMethodName: string;
			let INVALID_SERVICE_NAME: string;
			let isAdmin: boolean;
			let VALID_SERVICE_NAME: string;
			beforeEach(() => {
				callingMethodName = 'testMethod';
				INVALID_SERVICE_NAME = 'invalid-service-name'; // use a dummy service name for testing
				isAdmin = true; // set to true to allow admin operations in tests
				VALID_SERVICE_NAME = config.get<string>('security.collaborators.user.serviceName')!;
			});

			it('returns true when calling service name matches config value', () => {
				// arrange
				// act & assert
				expect(service['checkIsValidCaller'](VALID_SERVICE_NAME, callingMethodName, isAdmin)).toBe(true);
			});

			it('throws UnauthorizedAccessError when calling service name does not match config value', () => {
				// arrange
				// act & assert
				expect(() => service['checkIsValidCaller'](INVALID_SERVICE_NAME, callingMethodName, false))
					.toThrow(UnauthorizedAccessError);
			});

			it('throws UnauthorizedAccessError when isAdmin is false regardless of calling service name', () => {
				// arrange
				isAdmin = false; // set to false to simulate non-admin user
				
				// act & assert
				expect(() => service['checkIsValidCaller'](VALID_SERVICE_NAME, callingMethodName, isAdmin))
					.toThrow(UnauthorizedAccessError);
			});

			it('includes the callerName and requestingServiceName in error message', () => {
				// arrange
				// act & assert
				try {
					service['checkIsValidCaller'](INVALID_SERVICE_NAME, callingMethodName, false);
					fail('Should have thrown an error');
				} catch (error) {
					expect(error).toBeInstanceOf(UnauthorizedAccessError);
					expect(error.message).toContain(INVALID_SERVICE_NAME);
					expect(error.message).toContain(callingMethodName);
					expect(error.message).toContain(service.constructor.name);
				}
			});
		});
		
		describe('findUserByMicroserviceId', () => {
			it('creates query with correct search criteria', async () => {
				// arrange
				const expectedQuery = new Query({
					searchCriteria: [
						{
							key: 'userId',
							operation: SearchFilterOperation.EQUALS,
							value: randomUserId
						}
					]
				});
				
				// act
				await service['findUserByMicroserviceId'](randomUserId);
				
				// assert
				expect(userRepo.fetchByQuery).toHaveBeenCalledTimes(1);

				const params = userRepoFetchByQuerySpy.mock.calls[0];
				const [ query, _] = params; // destructure the first two parameters

				expect(query.searchCriteria).toEqual(expectedQuery.searchCriteria);
			});
			
			it('returns user from observable when query succeeds with single match', async () => {
				// arrange
				// act
				const result = await service['findUserByMicroserviceId'](randomUserId);
				
				// assert
				expect(result).toBeDefined();
				expect(result!.userId).toBe(randomUserId);
			});

			it('returns undefined when no user with matching user id is found', async () => {
				// arrange
				jest.spyOn(userRepo, 'fetchByQuery').mockResolvedValue(
					Result.ok(of([]))
				);
				
				// act
				const result = await service['findUserByMicroserviceId']('non-existing-user-id');
				
				// assert
				expect(result).toBeUndefined();
			});

			it('throws PersistenceError if query fails', async () => {
				// arrange
				const errorMessage = 'Database connection failed';
				jest.spyOn(userRepo, 'fetchByQuery').mockResolvedValue(
					Result.fail(errorMessage)
				);
				
				// act & assert
				await expect(service['findUserByMicroserviceId'](randomUserId))
					.rejects
					.toThrow(new PersistenceError(`Failed to fetch user entity: ${errorMessage}`));
			});

			it('throws PersistenceError if more than one user with matching user id is found', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy.mockResolvedValue(
					Result.ok(of([randomUser, randomUser])) // simulate multiple users with the same user
					// id, which should not happen in a well-designed system
				);
				
				// act & assert
				await expect(service['findUserByMicroserviceId'](randomUserId))
					.rejects
					.toThrow(new PersistenceError(`User entity with id ${randomUserId} is not unique`));
			});
			
			/*it('takes only the first emission from the observable', async () => {
				// arrange
				const observableSpy = jest.fn(() => of(users));
				
				jest.spyOn(userRepo, 'fetchByQuery').mockResolvedValue(
					Result.ok(observableSpy())
				);
				
				// act
				await service['findUserByMicroserviceId'](randomUserId);
				
				// assert
				expect(observableSpy).toHaveBeenCalledTimes(1);
			});
			*/
		});
		
		describe('getUniqueUser', () => {
			let testCallerName: string;
			beforeEach(() => {
				testCallerName = 'getUniqueUser';
			});
			
			it('returns the user when found', async () => {
				// Arrange
				jest.spyOn(service as any, 'findUserByMicroserviceId').mockResolvedValue(randomUser);
				
				// Act
				const result = await service['getUniqueUser'](randomUserId, testCallerName);
				
				// Assert
				expect(result).toBe(randomUser);
				expect(service['findUserByMicroserviceId']).toHaveBeenCalledWith(randomUserId);
			});
			
			it('throws PersistenceError when user is not found', async () => {
				// Arrange
				jest.spyOn(service as any, 'findUserByMicroserviceId').mockResolvedValue(undefined);
				
				// Act & Assert
				await expect(service['getUniqueUser'](randomUserId, testCallerName))
				.rejects
				.toThrow(PersistenceError);
			});
			
			it('includes userId in error message when user not found', async () => {
				// Arrange
				jest.spyOn(service as any, 'findUserByMicroserviceId').mockResolvedValue(undefined);
				
				// Act & Assert
				try {
				await service['getUniqueUser'](randomUserId, testCallerName);
				fail('Should have thrown an error');
				} catch (error) {
				expect(error.message).toContain(randomUserId);
				}
			});
			
			it('includes caller name in error message when user not found', async () => {
				// Arrange
				jest.spyOn(service as any, 'findUserByMicroserviceId').mockResolvedValue(undefined);
				
				// Act & Assert
				try {
				await service['getUniqueUser'](randomUserId, testCallerName);
				fail('Should have thrown an error');
				} catch (error) {
				expect(error.message).toContain(testCallerName);
				}
			});
			
			it('includes service name in error message when user not found', async () => {
				// Arrange
				jest.spyOn(service as any, 'findUserByMicroserviceId').mockResolvedValue(undefined);
				
				// Act & Assert
				try {
				await service['getUniqueUser'](randomUserId, testCallerName);
				fail('Should have thrown an error');
				} catch (error) {
				expect(error.message).toContain(service.constructor.name);
				}
			});
			
			it('passes through errors from findUserByMicroserviceId', async () => {
				// Arrange
				const expectedError = new PersistenceError('Database connection failed');
				jest.spyOn(service as any, 'findUserByMicroserviceId').mockRejectedValue(expectedError);
				
				// Act & Assert
				await expect(service['getUniqueUser'](randomUserId, testCallerName))
				.rejects
				.toBe(expectedError);
			});
		});
	});
});