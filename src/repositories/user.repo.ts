import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from 'uuid';

import {
	EntityCreatedEvent,
	EntityCreatedEventDTO,
	EntityDeletedEvent,
	EntityDeletedEventDTO,
	EntityDTO,
	EntityId,
	EntityMetadataDTO,
	EntityPersistenceDTO,
	EntityUpdatedEvent,
	EntityUpdatedEventDTO,
	Logger,
	PersistenceAdapter,
	Repository,
	Result
} from "@evelbulgroz/ddd-base";
import { EntityUndeletedEvent } from '@evelbulgroz/ddd-base/dist/events/entity-undeleted.event.class'; // workaround until included in ddd-base package
import { EntityUndeletedEventDTO } from '@evelbulgroz/ddd-base/dist/dtos/entity-undeleted.event.dto'; // workaround until included in ddd-base package

import { User } from "../domain/user.entity";
import { UserCreatedEvent } from "../events/user-created.event";
import { UserDTO } from "../dtos/domain/user.dto";
import { UserUpdatedEvent } from "../events/user-updated.event";
import { UserDeletedEvent } from "../events/user-deleted.event";
import { UserUndeletedEvent } from "../events/user-undeleted.event";

/** Notionally abstract class that describes and provides default features for any User repository
 * @remark Exists mostly to enable clients to depend on abstractions rather than a specific implementations
 * @remark Clients should inject this class and depend on the injector to provide the concrete implementation at runtime
 * @remark NestJS's DI system cannot inject abstract classes, so this class is not marked abstract though it should be treated as such
 * @remark Must be extended by a concrete class specific to a particular persistence layer
*/
@Injectable()
export class UserRepository extends Repository<User, UserDTO> {

	//------------------------------ CONSTRUCTOR ----------------------------//
	
		public constructor(
			protected readonly adapter: PersistenceAdapter<EntityPersistenceDTO<UserDTO, EntityMetadataDTO>>,
			protected readonly logger: Logger,
			@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
		) {
			super(adapter, logger, throttleTime);
		}
	
	//------------------------ PUBLIC STATIC METHODS ------------------------//

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

	//------------------------------ PUBLIC API -----------------------------//

	// NOTE: Currently, base class public API is fully sufficient for this class
	
	//------------------- TEMPLATE METHOD IMPLEMENTATIONS -------------------//	
		
		protected getClassFromDTO(dto: UserDTO): Result<any> {
			const className = dto.className;
			switch (className) {
				case 'User':
					return Result.ok<any>(User);
				// Add more cases as needed
				default:
					return Result.fail<any>(`Unknown or unsupported log type: ${className}`);
			}
		}
		
	//---------------------- PROTECTED METHOD OVERRIDES ---------------------//

	/** Create user created event
	 * @param user The user to create the event for
	 * @returns The user created event
	 */
	protected override createEntityCreatedEvent(user?: User): UserCreatedEvent {
		const event = new UserCreatedEvent({
			eventId: uuidv4(),
			eventName: 'UserCreatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: user?.toDTO() as UserDTO
		});

		return event as any; // todo: sort out the generics later
	}

	/** Create user updated event
	 * @param user The user to create the event for
	 * @returns The user updated event
	 */
	protected override createEntityUpdatedEvent(user?: User): UserUpdatedEvent {
		const event = new UserUpdatedEvent({
			eventId: uuidv4(),
			eventName: 'UserUpdatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: user?.toDTO() as UserDTO
		});

		return event as any; // todo: sort out the generics later
	}

	/** Create user deleted event
	 * @param id The user id to create the event for
	 * @returns The user deleted event
	 */
	protected override createEntityDeletedEvent(id?: EntityId): UserDeletedEvent {
		const event = new UserDeletedEvent({
			eventId: uuidv4(),
			eventName: 'UserDeletedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: { entityId: id } as Partial<UserDTO>
		});

		return event as any; // todo: sort out the generics later
	}

	protected createEntityUndeletedEvent(entityId: EntityId, undeletionDate: Date): UserUndeletedEvent {
		const event = new UserUndeletedEvent({
			eventId: uuidv4(),
			eventName: UserUndeletedEvent.name,
			occurredOn: undeletionDate.toISOString(),
			payload: { entityId } as Partial<UserDTO>
		});
		return event as any; // todo: sort out the generics later
	}
}

export default UserRepository;