import { Inject, Injectable } from "@nestjs/common";

import { Observable, Subscription } from "rxjs";
import { v4 as uuidv4 } from 'uuid';

import { EntityId, LogEntry, LogLevel, PersistenceAdapter, Repository, Result } from "@evelbulgroz/ddd-base";
import { Logger } from "@evelbulgroz/logger";
import { Query, SearchFilterOperation } from "@evelbulgroz/query-fns";

import ManagedStatefulComponentMixin from "../../app-health/mixins/managed-stateful-component.mixin";
import User from "../domain/user.entity";
import UserCreatedEvent from "../events/user-created.event";
import UserDTO from "../dtos/user.dto";
import UserUpdatedEvent from "../events/user-updated.event";
import UserDeletedEvent from "../events/user-deleted.event";
import UserUndeletedEvent from "../events/user-undeleted.event";
import UserPersistenceDTO from "../dtos/user-persistence.dto";

/** Concrete implementation of an injectable UserRepository that uses an adapter to interact with a persistence layer
 * @remark This class is a repository for User entities, and is intended to be injected into other classes, e.g. services.
 * @remark Implements a few method overrides but otherwise relies on the base class for most of its functionality.
 */
@Injectable()
export class UserRepository extends ManagedStatefulComponentMixin(Repository<User, UserDTO>) {
	//---------------------------------------- PROPERTIES ---------------------------------------//
	
	protected readonly subscriptions: Subscription[] = []; // array of subscriptions to be cleaned up on shutdown			

	//---------------------------------------- CONSTRUCTOR --------------------------------------//
	
		public constructor(
			protected readonly adapter: PersistenceAdapter<UserPersistenceDTO>,
			protected readonly logger: Logger,
			@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
		) {
			super(adapter, throttleTime);
		}
	
	//---------------------------------------- DATA API ---------------------------------------//

	/** Get the class constructor from a class name
	 * @param className The name of the class to get
	 * @returns A Result wrapping the class constructor if successful, otherwise a failure result
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

	/* Find user by microservice id
	 * @param userId The user id in the user microservice
	 * @returns A Result wrapping a promise that resolves to matching user entity/s if found, or undefined if not found
	 * @returns {failure} If fetching user from the repository fails
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

	/* Subscribe to log events and log them using the logger (helper for executeInitialization)
	 * @returns void
	 * @throws Error if subscription fails
	 * @remark This method is called by the mixin during initialization, and should not be called directly
	 */
	protected initializeLogging(): void {
		const logsSub = this.logs$.subscribe({
			next: (log: LogEntry) => {
				switch (log.level) {
					case LogLevel.LOG:
						this.logger.log(log.message, log.context);
						break;
					case LogLevel.WARN:
						this.logger.warn(log.message, log.context);
						break;
					case LogLevel.ERROR:
						this.logger.error(log.message, log.data, log.context);
						break;
					case LogLevel.INFO:
						this.logger.info(log.message, log.context);
						break;
					case LogLevel.DEBUG:
						this.logger.debug(log.message, log.context);
						break;
					case LogLevel.VERBOSE:
						this.logger.verbose(`${log.message}, ${log.data}`, log.context);
						break;
					default:
						this.logger.log(log.message, log.context);
						break;
				}
			}
		});
		this.subscriptions.push(logsSub); // base class should complete the oberservable on shutdown, but add it to the list just in case
		this.log(LogLevel.LOG, `Subscribed to logs`);
	}

	/** Execute repository initialization (required by ManagedStatefulComponentMixin)
	 * @returns Promise that resolves when initialization is complete
	 * @throws Error if initialization fails
	 * @remark Basically calls base class initialize method and unwraps the result
     */
    protected async executeInitialization(): Promise<void> {
		this.initializeLogging(); // initialize logging before anything else
        this.log(LogLevel.LOG, `Executing initialization`);
		
		// Repository.initialize() does most of the work, so we just need to call it and unwrap its result here
		const mixinProto = Object.getPrototypeOf(Object.getPrototypeOf(this)); // jump past the mixin
		const realSuper = Object.getPrototypeOf(mixinProto); // get reference to TrainingLogRepo
		const initResult = await realSuper.initialize.call(this);
		if (initResult.isFailure) {
			this.log(LogLevel.ERROR, `Failed to execute initialization`, undefined, initResult.error);
			throw new Error(`Failed to execute initialization ${this.constructor.name}: ${initResult.error}`);
		}
		
		// If/when needed, add local initialization here
        
		this.log(LogLevel.LOG, `Initialization executed successfully`);
        return Promise.resolve();
    }
    
    /** Execute repository shutdown (required by ManagedStatefulComponentMixin)
	 * @returns Promise that resolves when shutdown is complete
	 * @throws Error if shutdown fails
	 * @remark Basically calls base class shutdown method and unwraps the result
     */
    protected async executeShutdown(): Promise<void> {
        this.log(LogLevel.LOG, `Executing shutdown`);

		// Repository.shutdown() does most of the work, so we just need to call it and unwrap its result here
		const mixinProto = Object.getPrototypeOf(Object.getPrototypeOf(this)); // jump past the mixin
		const realSuper = Object.getPrototypeOf(mixinProto); // get reference to TrainingLogRepo
		const shutdownResult = await realSuper.shutdown.call(this);
		if (shutdownResult.isFailure) {
			this.log(LogLevel.ERROR, `Failed to execute shutdown`, undefined, shutdownResult.error);
			throw new Error(`Failed to execute shutdown ${this.constructor.name}: ${shutdownResult.error}`);
		}
		
		// Clean up subscriptions
		this.subscriptions.forEach((sub: Subscription) => sub?.unsubscribe());
		
		this.logger.log(`Shutdown executed successfully`); // log to the logger, repo log stream is closed at this point
        return Promise.resolve();
    }

	// NOTE: Repository.isReady() is basically a call to initialize(), so no need to override or call it here. The mixin is sufficient.

	//----------------------------- TEMPLATE METHOD IMPLEMENTATIONS -----------------------------//	
		
	protected getClassFromDTO(dto: UserDTO): Result<any> {
			return UserRepository.getClassFromName(dto.className);			
	}

	//-------------------------------- PROTECTED METHOD OVERRIDES -------------------------------//

	/** Create user created event
	 * @param user The user to create the event for
	 * @returns The user created event
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

	/** Create user updated event
	 * @param user The user to create the event for
	 * @returns The user updated event
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

	/** Create user deleted event
	 * @param entityId The user id to create the event for
	 * @returns The user deleted event
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

	/** Create user undeleted event
	 * @param entityId The user id to create the event for
	 * @param undeletionDate The date the user was undeleted
	 * @returns The user undeleted event
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