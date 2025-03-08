import { Inject, Injectable } from "@nestjs/common";

import { v4 as uuidv4 } from 'uuid';

import { EntityId, EntityMetadataDTO, Logger, PersistenceAdapter, Result } from "@evelbulgroz/ddd-base";
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogCreatedEvent } from "../events/conditioning-log-created.event";
import { ConditioningLogDeletedEvent } from "../events/conditioning-log-deleted.event";
import { ConditioningLogDTO } from "../dtos/conditioning-log.dto";
import { ConditioningLogPersistenceDTO } from "../dtos/conditioning-log-persistence.dto";
import { ConditioningLogUndeletedEvent } from "../events/conditioning-log-undeleted.event";
import { ConditioningLogUpdatedEvent } from "../events/conditioning-log-updated.event";

/** Concrete implementation of an injectable ConditioningLogRepository that uses an adapter to interact with a persistence layer
 * @template T The type of the log, e.g. ConditioningLog
 * @template U The type of the DTO, e.g. ConditioningLogDTO
 * @remark This class is a repository for ConditioningLog entities, and is intended to be injected into other classes, e.g. services.
 * @remark Implements a few method overrides but otherwise relies on the base class for most of its functionality.
 */
@Injectable()
export class ConditioningLogRepository<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLogRepo<ConditioningLog<T,U>, U> {
	//---------------------------------------- CONSTRUCTOR --------------------------------------//

	public constructor(
		protected readonly adapter: PersistenceAdapter<ConditioningLogPersistenceDTO<any, EntityMetadataDTO>>,
		protected readonly logger: Logger,
		@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
	) {
		super(adapter, logger, throttleTime);
	}
	
	//---------------------------------------- PUBLIC API ---------------------------------------//

	// NOTE: Currently, base class public API is fully sufficient for this class
		
	//----------------------------- TEMPLATE METHOD IMPLEMENTATIONS -----------------------------//	
	
	protected getClassFromDTO(dto: U): Result<any> {
		const className = dto.className;
		switch (className) {
			case 'ConditioningLog':
				return Result.ok<any>(ConditioningLog);
			// Add more cases as needed
			default:
				return Result.fail<any>(`Unknown or unsupported log type: ${className}`);
		}
	}
	
	//------------------------------- PROTECTED METHOD OVERRIDES --------------------------------//
	
	// todo: figure out a better way to handle imports
	/*
	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates();
		// base class initialization logs completion
		return Promise.resolve(Result.ok<void>());
	}
	*/

	/** Create log created event
	 * @param user The log to create the event for
	 * @returns The log created event
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityCreatedEvent(log: ConditioningLog<T,U>): ConditioningLogCreatedEvent {
		return new ConditioningLogCreatedEvent({
			eventId: uuidv4(),
			eventName: ConditioningLogCreatedEvent.name,
			occurredOn: (new Date()).toUTCString(),
			payload: log?.toDTO() as ConditioningLogDTO
		});
	}

	/** Create log updated event
	 * @param user The log to create the event for
	 * @returns The log updated event
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityUpdatedEvent(log: ConditioningLog<T,U>): ConditioningLogUpdatedEvent {
		return new ConditioningLogUpdatedEvent({
			eventId: uuidv4(),
			eventName: ConditioningLogUpdatedEvent.name,
			occurredOn: (new Date()).toUTCString(),
			payload: log.toDTO()
		});
	}

	/** Create log deleted event
	 * @param entityId The log id to create the event for
	 * @returns The log deleted event
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityDeletedEvent(entityId?: EntityId): ConditioningLogDeletedEvent {
		return new ConditioningLogDeletedEvent({
			eventId: uuidv4(),
			eventName: ConditioningLogDeletedEvent.name,
			occurredOn: (new Date()).toUTCString(),
			payload: { entityId, className: 'ConditioningLog' } as Partial<ConditioningLogDTO>
		});
	}

	/** Create log undeleted event
	 * @param entityId The log id to create the event for
	 * @param undeletionDate The date the log was undeleted
	 * @returns The log undeleted event
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected override createEntityUndeletedEvent(entityId: EntityId, undeletionDate: Date): ConditioningLogUndeletedEvent {
			return new ConditioningLogUndeletedEvent({
				eventId: uuidv4(),
				eventName: ConditioningLogUndeletedEvent.name,
				occurredOn: undeletionDate.toISOString(),
				payload: { entityId, className: 'ConditioningLog' } as Partial<ConditioningLogDTO>
			});
	}
	
	protected override getEntityFromDTO(dto: U): T | undefined {
		let entity = super.getEntityFromDTO(dto); // searches the cache by ID
		if (entity) { return entity as T; }
		return this.cache.value.find(e => { // try to find the entity by source ID in the cache
			// comparing primitives, so no need to serialize the entiry or deserialize the DTO
			return (e.meta?.sourceId?.id === dto.meta?.sourceId?.id && e.meta?.sourceId?.source === dto.meta?.sourceId?.source);
		}) as T | undefined;
	}	
}

export default ConditioningLogRepository;