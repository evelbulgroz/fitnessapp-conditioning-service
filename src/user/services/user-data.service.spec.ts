import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, of,  Subject, take } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {ComponentState, ComponentStateInfo} from "../../libraries/managed-stateful-component";
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { StreamLogger } from '../../libraries/stream-loggable';

import createTestingModule from '../../test/test-utils';
import EntityIdDTO from '../../shared/dtos/requests/entity-id.dto';
import { User, UserDataService, UserDTO, UserRepository } from '..'; // shortcut import for all user-related modules
import UserContext from '../../shared/domain/user-context.model';
import UserIdDTO from '../../shared/dtos/requests/user-id.dto';


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
	let userContext: UserContext;
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

	/*describe('Component Lifecycle', () => {
		it('can be created', () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(UserDataService);
		});

		// NOTE: Mostly just testing that the lifecycle method calls are effectively routed to the base clase by the mixin.

		describe('Initialization', () => {
			it('can be initialized', async () => {
				// arrange
				// act/assert
				expect(async () => await service.initialize()).not.toThrow(); // just check that it doesn't throw
			});

			// NOTE: UserDataService does not currently have any specific initialization logic, so no need to test it here.
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
				expect(service['subscriptions'].length).toBe(1); // sanity check	
				
				await service.initialize(); // initialize the service
				
				// act
				await service.shutdown();

				// assert
				expect(service['subscriptions'].length).toBe(0); // all subscriptions should be cleared
			});
		});	
	});
	*/	

	describe('Data API', () => {
		describe('createUser', () => {
			let newUserId: EntityId;
			let newUser: User;
			beforeEach(() => {
				newUserId = uuidv4();
				newUser = User.create({entityId: uuidv4(), userId: newUserId, logs: [], className: 'User' }).value as unknown as User;
				
				userRepoCreateSpy.mockRestore();
				userRepoCreateSpy = jest.spyOn(userRepo, 'create').mockReturnValue(Promise.resolve(Result.ok(newUser)));				
			});

			xit('initializes the service', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));
				
				// act
				void await service.createUser(userContext.userName, newUserId);

				// assert
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});

			it('can create a new User entity', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = await service.createUser(userContext.userName, newUserId, isAdmin);

				// assert
				expect(userRepoCreateSpy).toHaveBeenCalledTimes(1);
				expect(userRepoCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: newUserId }));
				expect(userRepoFetchByQuerySpy).toHaveBeenCalledTimes(1);
				
				expect(result).toEqual(newUser.entityId);
			});

			/*it('throws error if caller is not user microservice', async () => {
				// arrange
				const invalidContext = new UserContext({
					userId: randomUser.userId,
					userName: 'invalid',
					userType: 'service',
					roles: ['admin'],
				});

				// act
				const result = service.createUser(invalidContext, newUserIdDTO);

				// assert
				await expect(result).rejects.toThrow('User invalid not authorized to access UserDataService.createUser');
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
				const result = service.createUser(invalidContext, newUserIdDTO);

				// assert
				await expect(result).rejects.toThrow('User fitnessapp-user-service not authorized to access UserDataService.createUser');
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				randomUserId['_value'] = null as unknown as string;
				
				// act
				const result = service.createUser(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow("UserDataService.createUser requires a valid user id, got: null");
			});

			it('throws error if user with same microservice user id already exists', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([newUser]))));

				// act
				const result = service.createUser(userContext, newUserIdDTO);

				// assert
				await expect(result).rejects.toThrow(/already exists/);
			});*/
		});
		
		/*describe('deleteUser', () => {
			xit('initializes the service', async () => {
				// arrange
				
				// act
				const result = await service.deleteUser(userContext, randomUserId);

				// assert
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});

			it('can delete a User entity by its user id in the user microservice', async () => {
				// arrange
				
				// act
				const result = await service.deleteUser(userContext, randomUserId);

				// assert
				expect(result).toBeUndefined();
				expect(userRepoDeleteSpy).toHaveBeenCalledTimes(1);
			});

			it('by default soft deletes the user entity', async () => {
				// arrange
				expect(randomUser.deletedOn).not.toBeDefined(); // sanity check
				
				// act
				const result = await service.deleteUser(userContext, randomUserId);

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
				const result = await service.deleteUser(userContext, randomUserId, true);

				// assert
				expect(userRepoDeleteSpy).not.toHaveBeenCalled();
				expect(result).toBeUndefined();
				expect(randomUser.deletedOn).toEqual(originalDeletedOn);
			});

			it('optionally hard deletes the user entity', async () => {
				// arrange
				const originalEntityId = randomUser.entityId;		
				
				// act
				const result = await service.deleteUser(userContext, randomUserId, false);

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
				const result = service.deleteUser(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User invalid not authorized to access UserDataService.delete');
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
				const result = service.deleteUser(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User fitnessapp-user-service not authorized to access UserDataService.delete');
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				randomUserId['_value'] = null as unknown as string;
				
				// act
				const result = service.deleteUser(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow("UserDataService.delete requires a valid user id, got: null");
			});

			it('throws error if user does not exist', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = service.deleteUser(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow(/does not exist/);
			});
		});*/	
		
		/*describe('undeleteUser', () => {
			xit('initializes the service', async () => {
				// arrange
				
				// act
				const result = await service.undeleteUser(userContext, randomUserId);

				// assert
				expect(userRepoIsReadySpy).toHaveBeenCalledTimes(1);
			});

			it('can undelete a User entity by its user id in the user microservice', async () => {
				// arrange
				randomUser.deletedOn = new Date(randomUser.createdOn!.getTime() + 1000);
				
				// act
				const result = await service.undeleteUser(userContext, randomUserId);

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
				const result = await service.undeleteUser(userContext, randomUserId);

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
				const result = service.undeleteUser(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User invalid not authorized to access UserDataService.undelete');
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
				const result = service.undeleteUser(invalidContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow('User fitnessapp-user-service not authorized to access UserDataService.undelete');
			});

			it('throws error if user id is invalid', async () => {
				// arrange
				randomUserId['_value'] = null as unknown as string;
				
				// act
				const result = service.undeleteUser(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow("UserDataService.undelete requires a valid user id, got: null");
			});

			it('throws error if user does not exist', async () => {
				// arrange
				userRepoFetchByQuerySpy.mockRestore();
				userRepoFetchByQuerySpy = jest.spyOn(userRepo, 'fetchByQuery').mockReturnValue(Promise.resolve(Result.ok(of([]))));

				// act
				const result = service.undeleteUser(userContext, randomUserId);

				// assert
				await expect(result).rejects.toThrow(/does not exist/);
			});
		});*/
	});

	/*describe('Management API', () => {
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
	*/

	/*describe('Logging API', () => {
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
	*/	

	/*describe('Protected Methods', () => {
		describe('checkIsValidCaller()', () => {  }); // todo: implement tests
		describe('checkIsValidId()', () => {  }); // todo: implement tests
		describe('findUserByMicroserviceId', () => {}); // todo: implement tests
		describe('getUniqueUser()', () => {}); // todo: implement tests
	});
	*/
});