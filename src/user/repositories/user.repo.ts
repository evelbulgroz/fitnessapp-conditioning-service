import { Inject, Injectable } from "@nestjs/common";

import { v4 as uuidv4 } from 'uuid';

import {
	EntityId,
	EntityMetadataDTO,
	EntityPersistenceDTO,
	Logger,
	PersistenceAdapter,
	Repository,
	Result
} from "@evelbulgroz/ddd-base";

import { User } from "../domain/user.entity";
import { UserCreatedEvent } from "../events/user-created.event";
import { UserDTO } from "../dtos/user.dto";
import { UserUpdatedEvent } from "../events/user-updated.event";
import { UserDeletedEvent } from "../events/user-deleted.event";
import { UserUndeletedEvent } from "../events/user-undeleted.event";
import { Query, SearchFilterOperation } from "@evelbulgroz/query-fns";
import { Observable } from "rxjs";

/** Concrete implementation of an injectable UserRepository that uses an adapter to interact with a persistence layer
 * @remark This class is a repository for User entities, and is intended to be injected into other classes, e.g. services.
 * @remark Implements a few method overrides but otherwise relies on the base class for most of its functionality.
 */
@Injectable()
export class UserRepository extends Repository<User, UserDTO> {

	//---------------------------------------- CONSTRUCTOR --------------------------------------//
	
		public constructor(
			protected readonly adapter: PersistenceAdapter<EntityPersistenceDTO<UserDTO, EntityMetadataDTO>>,
			protected readonly logger: Logger,
			@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
		) {
			super(adapter, logger, throttleTime);
		}
	
	//---------------------------------------- PUBLIC API ---------------------------------------//

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