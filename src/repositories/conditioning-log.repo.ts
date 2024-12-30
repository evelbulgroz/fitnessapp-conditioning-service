import { Injectable } from "@nestjs/common";

import { Observable } from "rxjs";
import { v4 as uuidv4 } from 'uuid';

import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { EntityCreatedEvent, EntityCreatedEventDTO, EntityDeletedEvent, EntityDeletedEventDTO, EntityDTO, EntityId, EntityUpdatedEvent, EntityUpdatedEventDTO, Logger, Result } from "@evelbulgroz/ddd-base";
import { Query } from "@evelbulgroz/query-fns";
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";

import { LogCreatedEvent } from "../events/log-created.event";
import { LogDeletedEvent } from "../events/log-deleted.event";
import { LogUpdatedEvent } from "../events/log-updated.event";

/**@classdesc Describes and provides default features for any ConditioningLog repository
 * @remark Exists mostly to enable clients to depend on abstractions rather than a specific implementations
 * @remark Clients should inject this class and depend on the injector to provide the concrete implementation at runtime
 * @remark NestJS's DI system cannot inject abstract classes, so this class is not marked abstract though it should be treated as such
 * @remark Must be extended by a concrete class specific to a particular persistence layer
*/
@Injectable()
export class ConditioningLogRepo<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLogRepo<ConditioningLog<T,U>, U> {
	
	//---------------------------- CONSTRUCTOR ---------------------------//

	public constructor(logger?: Logger, throttleTime?: number) {
		super(logger, throttleTime);
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
			case 'ConditioningLog':
				return Result.ok<any>(ConditioningLog);
			// Add more cases as needed
			default:
				return Result.fail<any>(`Unknown or unsupported log type: ${className}`);
		}
	}

	//---------------------------- PUBLIC METHODS ---------------------------//
	
	/** Fetch entities by query criteria
	 * @param criteria The query criteria to use to filter entities
	 * @param matchAll If true, all criteria must match; otherwise, any criteria matching is sufficient
	 * @returns A Result wrapping an Observable of the entities matching the query criteria
	 * @remark Exists to enforce use of ConditioningLogQueryCriteria, otherwise delegates to base class
	 * @todo Consider if this is still needed now that the logs method takes a query
	 */
	public async fetchByQuery(criteria: Query<any,any>, matchAll: boolean = false): Promise<Result<Observable<ConditioningLog<T,U>[]>>> {
		throw new Error("Method not implemented: implement in concrete subclass");
	}

	//------------------------ PROTECTED METHODS ------------------------//
	
	/** Create log created event
	 * @param log The log to create the event for
	 * @returns The log created event
	 */
	protected override createEntityCreatedEvent(log?: T): EntityCreatedEvent<EntityCreatedEventDTO<any>, EntityDTO> {
		const event = new LogCreatedEvent({
			eventId: uuidv4(),
			eventName: 'LogCreatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: log?.toJSON() as ConditioningLogDTO
		});

		return event as any; // todo: sort out the generics later
	}

	/** Create log updated event
	 * @param log The log to create the event for
	 * @returns The log updated event
	 */
	protected override createEntityUpdatedEvent(log?: T): EntityUpdatedEvent<EntityUpdatedEventDTO<any>, EntityDTO> {
		const event = new LogUpdatedEvent({
			eventId: uuidv4(),
			eventName: 'LogUpdatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: log?.toJSON() as ConditioningLogDTO
		});

		return event as any; // todo: sort out the generics later
	}

	/** Create log deleted event
	 * @param id The log id to create the event for
	 * @returns The log deleted event
	 */
	protected override createEntityDeletedEvent(id?: EntityId): EntityDeletedEvent<EntityDeletedEventDTO<any>, EntityDTO> {
		const event = new LogDeletedEvent({
			eventId: uuidv4(),
			eventName: 'LogDeletedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: { entityId: id } as ConditioningLogDTO
		});

		return event as any; // todo: sort out the generics later
	}

	//---------------------------- PLACEHOLDERS -----------------------------//

	// NOTE: These methods are placeholders for the template methods that must be implemented in a concrete subclass:
	// since this class is not marked abstract, the compiler insists they must be also implemented here.

	protected initializePersistence(): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass");}
	protected populateEntityCache(): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async finalizeInitialization(): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async createEntity(dto: U, id: EntityId, overView?: boolean): Promise<Result<ConditioningLog<T,U>>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async updateEntity(entity: ConditioningLog<T,U>): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async retrieveEntity(entityId: EntityId, overview: boolean): Promise<Result<ConditioningLog<T,U>>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected async deleteEntity(entityId: EntityId): Promise<Result<void>> { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected getEntityFromDTO(dto: U): ConditioningLog<T, U> | undefined { throw new Error("Method not implemented: implement in concrete subclass"); }
	protected getClassFromDTO(dto: U): Result<T | undefined> { throw new Error("Method getClassFromDTO() not implemented: implement in concrete subclass"); }
}

export default ConditioningLogRepo;