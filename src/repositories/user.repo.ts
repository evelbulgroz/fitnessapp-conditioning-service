import { Injectable } from "@nestjs/common";

import { Observable } from "rxjs";
import { v4 as uuidv4 } from 'uuid';

import { User } from "../domain/user.entity";
import { UserDTO } from "../dtos/domain/user.dto";
import { Query } from "@evelbulgroz/query-fns";
import { EntityCreatedEvent, EntityCreatedEventDTO, EntityDeletedEvent, EntityDeletedEventDTO, EntityDTO, EntityId, EntityUpdatedEvent, EntityUpdatedEventDTO, Repository, Result } from "@evelbulgroz/ddd-base";

import { UserCreatedEvent } from "../events/user-created.event";
import { UserUpdatedEvent } from "../events/user-updated.event";
import { UserDeletedEvent } from "../events/user-deleted.event";

/** Notionally abstract class that describes and provides default features for any User repository
 * @remark Exists mostly to enable clients to depend on abstractions rather than a specific implementations
 * @remark Clients should inject this class and depend on the injector to provide the concrete implementation at runtime
 * @remark NestJS's DI system cannot inject abstract classes, so this class is not marked abstract though it should be treated as such
 * @note Must be extended by a concrete class specific to a particular persistence layer
*/
@Injectable()
export class UserRepository<T extends User, U extends UserDTO> extends Repository<User, UserDTO> {
	
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

	//---------------------------- PUBLIC METHODS ---------------------------//
	
	/** Fetch entities by query criteria
	 * @param criteria The query criteria to use to filter entities
	 * @param matchAll If true, all criteria must match; otherwise, any criteria matching is sufficient
	 * @returns A Result wrapping an Observable of the entities matching the query criteria
	 * @remark Exists to enforce use of UserQueryCriteria, otherwise delegates to base class
	 */
	public async fetchByQuery(criteria: Query<any,any>, matchAll: boolean = false): Promise<Result<Observable<User[]>>> {
		throw new Error("Method not implemented: implement in concrete subclass");
	}	
	
	//-------------------------- PROTECTED METHODS --------------------------//

	/** Create user created event
	 * @param user The user to create the event for
	 * @returns The user created event
	 */
	protected override createEntityCreatedEvent(user?: T): EntityCreatedEvent<EntityCreatedEventDTO<any>, EntityDTO> {
		const event = new UserCreatedEvent({
			eventId: uuidv4(),
			eventName: 'UserCreatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: user?.toJSON() as UserDTO
		});

		return event as any; // todo: sort out the generics later
	}

	/** Create user updated event
	 * @param user The user to create the event for
	 * @returns The user updated event
	 */
	protected override createEntityUpdatedEvent(user?: T): EntityUpdatedEvent<EntityUpdatedEventDTO<any>, EntityDTO> {
		const event = new UserUpdatedEvent({
			eventId: uuidv4(),
			eventName: 'UserUpdatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: user?.toJSON() as UserDTO
		});

		return event as any; // todo: sort out the generics later
	}

	/** Create user deleted event
	 * @param id The user id to create the event for
	 * @returns The user deleted event
	 */
	protected override createEntityDeletedEvent(id?: EntityId): EntityDeletedEvent<EntityDeletedEventDTO<any>, EntityDTO> {
		const event = new UserDeletedEvent({
			eventId: uuidv4(),
			eventName: 'UserDeletedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: { entityId: id } as UserDTO
		});

		return event as any; // todo: sort out the generics later
	}
	
	//-------------------------- PLACEHOLDERS FOR TEMPLATE METHODS ------------------------------//

	// NOTE: These methods are placeholders for the template methods that must be implemented in a concrete subclass:
	// since this class is not marked abstract, the compiler insists they must be also implemented here.

	protected initializePersistence(): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass");}
	protected populateEntityCache(): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async finalizeInitialization(): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async createEntity(dto: U, id: EntityId): Promise<Result<User>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async updateEntity(entity: User): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async retrieveEntity(entityId: EntityId): Promise<Result<User>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async deleteEntity(entityId: EntityId): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected getEntityFromDTO(dto: U): User | undefined { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected getClassFromDTO(dto: U): Result<T | undefined> { throw new Error("Method getClassFromDTO() not implemented: implement in concrete subclass"); }
}

export default UserRepository;