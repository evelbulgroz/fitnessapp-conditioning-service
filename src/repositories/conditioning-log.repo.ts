import { Injectable } from "@nestjs/common";

import { Observable } from "rxjs";
import { v4 as uuidv4 } from 'uuid';

import {
	EntityCreatedEvent,
	EntityCreatedEventDTO,
	EntityDeletedEvent,
	EntityDeletedEventDTO,
	EntityDTO,
	EntityId,
	EntityMetadataDTO,
	EntityUpdatedEvent,
	EntityUpdatedEventDTO,
	Logger,
	PersistenceAdapter,
	Result
} from "@evelbulgroz/ddd-base";
import { Query } from "@evelbulgroz/query-fns";
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { ConditioningLogPersistenceDTO } from "../dtos/domain/conditioning-log-persistence.dto";

import { LogCreatedEvent } from "../events/log-created.event";
import { LogDeletedEvent } from "../events/log-deleted.event";
import { LogUpdatedEvent } from "../events/log-updated.event";

/**@classdesc Concrete implementation of an injectable ConditioningLogRepo that uses an adapter to interact with a persistence layer */
@Injectable()
export class ConditioningLogRepo<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLogRepo<ConditioningLog<T,U>, U> {
	//---------------------------- CONSTRUCTOR ---------------------------//

	public constructor(
		protected readonly adapter: PersistenceAdapter<ConditioningLogPersistenceDTO<U, EntityMetadataDTO>>,
		protected readonly logger: Logger,
		protected readonly throttleTime?: number
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

	//-------------------------- PROTECTED METHODS --------------------------//
	
	// initialize the repository
	// todo: so generic by now, it should be moved to the base class
	protected async initializePersistence(): Promise<Result<void>> {
			this.logger.log(`${this.constructor.name}: Initializing persistence...`);
			const result = await this.adapter.initialize();
			if (result.isFailure) {
				return Promise.resolve(Result.fail<void>(result.error));
			}
			this.logger.log(`${this.constructor.name}: Persistence initialized.`);
			return Promise.resolve(Result.ok<void>());
	}
	
	// populate cache from data directory (cache is populated with overviews only, load details on demand)
	// todo: so generic by now, it should be moved to the base class
	protected async populateEntityCache(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Populating cache...`);
		const result = await this.adapter.fetchAll();
		if (result.isFailure) {
			return Promise.resolve(Result.fail<void>(result.error));
		}
		const dtos = result.value as ConditioningLogPersistenceDTO<U, EntityMetadataDTO>[];
		const logs = dtos.map(dto => {
			const createResult = this.createEntityFromPersistenceDTO(dto, dto.entityId, true);
			if (createResult.isFailure) {
				this.logger.error(`${this.constructor.name}: Failed to create entity from DTO: ${createResult.error}`);
				return undefined;
			}
			return createResult.value as T;
			})
			.filter(e => e !== undefined) as T[];
		this.cache.value.push(...logs);
		this.logger.log(`${this.constructor.name}: Cache populated with ${logs.length} logs.`);
		return Promise.resolve(Result.ok<void>());
	}


	//------------------- TEMPLATE METHOD IMPLEMENTATIONS -------------------//	

	// todo: remove once we have a better method for importing data
	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates();
		this.logger.log(`${this.constructor.name}: Initialization complete.`);
		return Promise.resolve(Result.ok<void>());
	}

	// NOTE: Unless using more specfic event names, just use the base class methods and remove these overrides
	
	/** Create log created event
	 * @param log The log to create the event for
	 * @returns The log created event
	 */
	protected override createEntityCreatedEvent(log?: T): EntityCreatedEvent<EntityCreatedEventDTO<any>, EntityDTO> {
		const event = new LogCreatedEvent({
			eventId: uuidv4(),
			eventName: 'LogCreatedEvent',
			occurredOn: (new Date()).toUTCString(),
			payload: log?.toDTO() as ConditioningLogDTO
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
			payload: log?.toDTO() as ConditioningLogDTO
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

	protected getEntityFromDTO(dto: U): T | undefined {
		return this.cache.value.find(e => { 
			if (typeof dto.entityId === 'string' || typeof dto.entityId === 'number') { // try to match by id, when possible and valid
				return e.entityId === dto.entityId;
			}
			else { // try to match by source id
				return (e.meta?.sourceId?.id === dto.meta?.sourceId?.id && e.meta?.sourceId?.source === dto.meta?.sourceId?.source);
			}
		}) as T | undefined;
	}

	protected getClassFromDTO(dto: U): Result<any> {
		return ConditioningLogRepo.getClassFromName(dto.className);
	}

	//----------------------- OTHER PROTECTED METHODS -----------------------//

	/* Create a new entity from a persistence DTO
	 * @param dto The persistence DTO to create the entity from
	 * @param id The entity ID to assign to the new entity (optional override of the ID in the DTO)
	 * @param overView If true, create an overview entity; otherwise, create a detailed entity
	 * @returns The new entity
	 * @throws Error if the entity class is unknown or unsupported
	 * @remark Exists to enable the generic creation of User entities from DTOs, while staying DRY
	 * @todo Remove when implemented in ddd-base library
	 */
	protected createEntityFromPersistenceDTO(dto: ConditioningLogPersistenceDTO<U, EntityMetadataDTO>, id?: EntityId, overView: boolean = true): Result<T> {
		const result = this.getClassFromDTO(dto);
		if (result.isFailure) {
			return Result.fail<T>(`Unknown or unsupported entity type: ${dto.className}`);
		}
		const ClassRef = result.value as typeof ConditioningLog;
		const metadataDTO = ClassRef.getMetaDataDTO(dto);
		if (id) { // assign the id if provided
			dto.entityId = id;
		}
		const createResult = ClassRef.create(dto, metadataDTO, overView);
		if (createResult.isFailure) {
			return Result.fail<T>(`Failed to create entity: ${createResult.error}`);
		}

		// creation succeeded - return the new entity
		return Result.ok<T>(createResult.value as unknown as T);
	}
}

export default ConditioningLogRepo;