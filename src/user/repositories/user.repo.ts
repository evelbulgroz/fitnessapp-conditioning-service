import { Inject, Injectable } from "@nestjs/common";

import { Observable, Subscription } from "rxjs";
import { v4 as uuidv4 } from 'uuid';

import { EntityId, RepoLogLevel, PersistenceAdapter, Repository, Result } from "@evelbulgroz/ddd-base";
import { ManagedStatefulComponent, ManagedStatefulComponentMixin } from "../../libraries/managed-stateful-component";
import { Query, SearchFilterOperation } from "@evelbulgroz/query-fns";

import User from "../domain/user.entity";
import UserCreatedEvent from "../events/user-created.event";
import UserDTO from "../dtos/user.dto";
import UserUpdatedEvent from "../events/user-updated.event";
import UserDeletedEvent from "../events/user-deleted.event";
import UserUndeletedEvent from "../events/user-undeleted.event";
import UserPersistenceDTO from "../dtos/user-persistence.dto";

/**
 * Concrete implementation of an injectable UserRepository that uses an adapter to interact with a persistence layer
 * 
 * @remark This class is a {@link Repository} for {@link User} entities, and is intended to be injected into other classes, e.g. services. 
 * @remark It implements a few method overrides but otherwise relies on the base class for most of its functionality.
 * @remark It applies the {@link ManagedStatefulComponentMixin} mixin as it is a key component whose state needs to be managed.
 * 
 */
@Injectable()
export class UserRepository extends ManagedStatefulComponentMixin(Repository<User, UserDTO>) implements ManagedStatefulComponent {
	//---------------------------------------- PROPERTIES ---------------------------------------//
	
	protected readonly subscriptions: Subscription[] = []; // array of subscriptions to be cleaned up on shutdown			

	//---------------------------------------- CONSTRUCTOR --------------------------------------//
	
		public constructor(
			protected readonly adapter: PersistenceAdapter<UserPersistenceDTO>, // the adapter to use for persistence
			@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
		) {
			super(adapter, throttleTime);
		}
	
	//---------------------------------------- DATA API ---------------------------------------//

	/**
	 * Get the class constructor from a class name
	 * 
	 * @param className The name of the class to get
	 * @returns A Result wrapping the class constructor if successful, otherwise a failure result
	 * 
	 * @remark Exists to enable the generic creation of User entities from DTOs, while staying DRY
	 * @remark Placeholder until base class is refactored to use a public static rather than a protected method
	 */
	public static getClassFromName(className: string): Result<any> {
		switch (className) {
			case 'User':
				return Result.ok<any>(User);
			// Add more cases as needed
			default:
				return Result.fail<any>(`Unknown or unsupported user type: ${className}`);
		}
	}

	/**
	 * Find user by microservice id
	 * 
	 * @param userId The user id in the user microservice
	 * @returns A Result wrapping a promise that resolves to matching user entity/s if found, or undefined if not found
	 * @returns {failure} If fetching user from the repository fails
	 * 
	 * @remark Internally calls fetchByQuery with a query that searches by userId
	 */
	public fetchByUserId(userId: EntityId, includeDeleted = false): Promise<Result<Observable<User[]>>> {
		const query = new Query<User, any>({
			searchCriteria: [
				{
					key: 'userId',
					operation: SearchFilterOperation.EQUALS,
					value: userId
				}
			]
		});

		return this.fetchByQuery(query, includeDeleted);
	}

	// NOTE: Rest of the public API is inherited from the base class, and is fully sufficient for the User repo.

	//------------------------------------- MANAGEMENT API --------------------------------------//
	
	/** @see ManagedStatefulComponentMixin for public management API methods */

	/**
	 * Execute repository initialization (called by ManagedStatefulComponentMixin)
	 * 
	 * @param superResult The result of the base class initialization
	 * @returns Promise that resolves when initialization is complete
	 * @throws Error if initialization fails
	 * 
	 * @remark Called from {@link ManagedStatefulComponentMixin}.initialize() method
	 * @remark Not really intended as a public API, but {@link ManagedStatefulComponentMixin} requires it to be public:
	 * use initialize() instead for public API
     */
    public async onInitialize(superResult: Result<void>): Promise<void> {
		this.log(RepoLogLevel.INFO, `Executing initialization`);
		
		// Repository.initialize() does most of the work, so we just need to check result from base class here
		if (superResult.isFailure) {
			this.log(RepoLogLevel.ERROR, `Failed to execute initialization`, superResult.error);
			throw new Error(`Failed to execute initialization ${this.constructor.name}: ${superResult.error}`);
		}
		
		// If/when needed, add local initialization here
        
		this.log(RepoLogLevel.INFO, `Initialization executed successfully`);
        return Promise.resolve();
    }
    
    /**
	 * Execute repository shutdown (called by ManagedStatefulComponentMixin)
	 * 
	 * @returns Promise that resolves when shutdown is complete
	 * @throws Error if shutdown fails
	 * 
	 * @remark Called from {@link ManagedStatefulComponentMixin}.shutdown() method
	 * @remark Not really intended as a public API, but {@link ManagedStatefulComponentMixin} requires it to be public:
	 * use shutdown() instead for public API
     */
    public async onShutdown(superResult: Result<void>): Promise<void> {
        this.log(RepoLogLevel.INFO, `Executing shutdown`);

		// Repository.shutdown() does most of the work, so we just need to check result from base class here
		if (superResult.isFailure) {
			this.log(RepoLogLevel.ERROR, `Failed to execute shutdown`, superResult.error);
			throw new Error(`Failed to execute shutdown ${this.constructor.name}: ${superResult.error}`);
		}
		
		// Clean up subscriptions
		this.subscriptions.forEach((sub: Subscription) => sub?.unsubscribe());
		
		return Promise.resolve();
    }

	// NOTE: Repository.isReady() is basically a call to initialize(), so no need to override or call it here. The mixin is sufficient.

	//----------------------------- TEMPLATE METHOD IMPLEMENTATIONS -----------------------------//	
		
	protected getClassFromDTO(dto: UserDTO): Result<any> {
			return UserRepository.getClassFromName(dto.className);			
	}

	//-------------------------------- PROTECTED METHOD OVERRIDES -------------------------------//

	/*
	 * Create user created event
	 * 
	 * @param user The user to create the event for
	 * @returns The user created event
	 * 
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityCreatedEvent(user?: User): UserCreatedEvent {
		return new UserCreatedEvent({
			eventId: uuidv4(),
			eventName: UserCreatedEvent.name,
			occurredOn: (new Date()).toUTCString(),
			payload: user?.toDTO() as UserDTO
		});
	}

	/*
	 * Create user updated event
	 *
	 * @param user The user to create the event for
	 * @returns The user updated event
	 * 
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityUpdatedEvent(user: User): UserUpdatedEvent {
		return new UserUpdatedEvent({
			eventId: uuidv4(),
			eventName: UserUpdatedEvent.name,
			occurredOn: (new Date()).toUTCString(),
			payload: user?.toDTO()
		});
	}

	/*
	 * Create user deleted event
	 * 
	 * @param entityId The user id to create the event for
	 * @returns The user deleted event
	 * 
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityDeletedEvent(entityId?: EntityId): UserDeletedEvent {
		return new UserDeletedEvent({
			eventId: uuidv4(),
			eventName: UserDeletedEvent.name,
			occurredOn: (new Date()).toUTCString(),
			payload: { entityId, className: 'User' } as Partial<UserDTO>
		});
	}

	/*
	 * Create user undeleted event
	 * 
	 * @param entityId The user id to create the event for
	 * @param undeletionDate The date the user was undeleted
	 * @returns The user undeleted event
	 * 
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityUndeletedEvent(entityId: EntityId, undeletionDate: Date): UserUndeletedEvent {
		return new UserUndeletedEvent({
			eventId: uuidv4(),
			eventName: UserUndeletedEvent.name,
			occurredOn: undeletionDate.toISOString(),
			payload: { entityId, className: 'User' } as Partial<UserDTO>
		});
	}
}

export default UserRepository;