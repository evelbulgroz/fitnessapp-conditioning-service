import { Inject, Injectable } from "@nestjs/common";

import { v4 as uuidv4 } from 'uuid';

import { Entity, EntityId, EntityMetadataDTO, PersistenceAdapter, Result } from "@evelbulgroz/ddd-base";
import { Logger } from '@evelbulgroz/logger';
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";

import ComponentState from '../../app-health/models/component-state';
import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogCreatedEvent } from "../events/conditioning-log-created.event";
import { ConditioningLogDeletedEvent } from "../events/conditioning-log-deleted.event";
import { ConditioningLogDTO } from "../dtos/conditioning-log.dto";
import { ConditioningLogPersistenceDTO } from "../dtos/conditioning-log-persistence.dto";
import { ConditioningLogUndeletedEvent } from "../events/conditioning-log-undeleted.event";
import { ConditioningLogUpdatedEvent } from "../events/conditioning-log-updated.event";
import ManagedStatefulComponentMixin from "../../app-health/mixins/managed-stateful-component.mixin";

/** Concrete implementation of an injectable ConditioningLogRepository that uses an adapter to interact with a persistence layer
 * @template T The type of the log, e.g. ConditioningLog
 * @template U The type of the DTO, e.g. ConditioningLogDTO
 * @remark This class is a repository for ConditioningLog entities, and is intended to be injected into other classes, e.g. services.
 * @remark Implements a few method overrides but otherwise relies on the base class for most of its functionality.
 */
@Injectable()
export class ConditioningLogRepository<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO>
	extends ManagedStatefulComponentMixin(TrainingLogRepo as any)<ConditioningLog<T,U>, U> {
	// implements OnModuleInit, OnModuleDestroy {

	//---------------------------------------- CONSTRUCTOR --------------------------------------//

	public constructor(
		protected readonly adapter: PersistenceAdapter<ConditioningLogPersistenceDTO<any, EntityMetadataDTO>>,
		protected readonly logger: Logger,
		@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
	) {
		super(adapter, logger, throttleTime);
	}
	
	//---------------------------------------- DATA API ---------------------------------------//

	// NOTE: Currently, base class data API is fully sufficient for this class
		
	//------------------------------------- MANAGEMENT API --------------------------------------//
	
	/** @see ManagedStatefulComponentMixin for public management API methods */

	/** Execute repository initialization (required by ManagedStatefulComponentMixin)
	 * @returns Promise that resolves when initialization is complete
	 * @throws Error if initialization fails
	 * @remark Basically calls base class initialize method and unwraps the result
     */
    protected async executeInitialization(): Promise<void> {
        this.logger.log(`Executing initialization`, this.constructor.name);
		
		// Go 3 levels up the prototype chain to reach TrainingLogRepo
        const mixinProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
        const realSuper = Object.getPrototypeOf(mixinProto);

		 // bug: overlapping state names in ddd-base and mixin cause this call never to return,
		 // as the state is already set to 'INITIALIZING' by the mixin when initialize() is called in the base class,
		 // which further causes the base class to never execute initialization and update the state to 'OK'.
		const initResults = await realSuper.initialize.call(this);
		if (initResults.isFailure) {
			this.logger.error(`Failed to execute initialization`, initResults.error, this.constructor.name);
			throw new Error(`Failed to execute initialization ${this.constructor.name}: ${initResults.error}`);
		}
		
		// If/when needed, add local initialization here
        
		this.logger.log(`Initialization executed successfully`, this.constructor.name);
        return Promise.resolve();
    }
    
    /** Execute repository shutdown (required by ManagedStatefulComponentMixin)
	 * @returns Promise that resolves when shutdown is complete
	 * @throws Error if shutdown fails
	 * @remark Basically calls base class initialize method and unwraps the result
     */
    protected async executeShutdown(): Promise<void> {
        this.logger.log(`Executing shutdown`, this.constructor.name);

		const initResults = await super.shutdown()
		if (initResults.isFailure) {
			this.logger.error(`Failed to execute shutdown`, initResults.error, this.constructor.name);
			throw new Error(`Failed to execute shutdown ${this.constructor.name}: ${initResults.error}`);
		}
		
		// If/when needed, add local shutdown here
        
		this.logger.log(`Shutdown executed successfully`, this.constructor.name);
        return Promise.resolve();
    }

	// NOTE:
	// ManagedStatefulComponentMixin completely shadows base repo management features:
	// there is perfect naming overlap re. both state values and members, e.g. `stateSubject`, `state$`, `initialize()` `getState()`, `isReady()`, `shutdown`.
	// So long as this is the case, there should be no need to override any of the base class methods here.
		

	//-------------------------------- TEMPLATE METHOD OVERRIDES --------------------------------//
	
	/** Create log created event
	 * @param user The log to create the event for
	 * @returns The log created event
	 * @remark Overriding base class method to return domain specific event type
	 */
	protected createEntityCreatedEvent(log: ConditioningLog<T,U>): ConditioningLogCreatedEvent {
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
	protected createEntityUpdatedEvent(log: ConditioningLog<T,U>): ConditioningLogUpdatedEvent {
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
	protected createEntityDeletedEvent(entityId?: EntityId): ConditioningLogDeletedEvent {
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
	protected createEntityUndeletedEvent(entityId: EntityId, undeletionDate: Date): ConditioningLogUndeletedEvent {
			return new ConditioningLogUndeletedEvent({
				eventId: uuidv4(),
				eventName: ConditioningLogUndeletedEvent.name,
				occurredOn: undeletionDate.toISOString(),
				payload: { entityId, className: 'ConditioningLog' } as Partial<ConditioningLogDTO>
			});
	}
	
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
	
	//------------------------------------ PROTECTED METHODS ------------------------------------//
	
	// todo: figure out a better way to handle imports
	/*
	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates();
		// base class initialization logs completion
		return Promise.resolve(Result.ok<void>());
	}
	*/

	protected getEntityFromDTO(dto: U): T | undefined {
		let entity = super.getEntityFromDTO(dto); // searches the cache by ID
		if (entity) { return entity as T; }
		return this.cache.value.find((e: any) => { // try to find the entity by source ID in the cache
			// comparing primitives, so no need to serialize the entiry or deserialize the DTO
			return (e.meta?.sourceId?.id === dto.meta?.sourceId?.id && e.meta?.sourceId?.source === dto.meta?.sourceId?.source);
		}) as T | undefined;
	}	
}
export default ConditioningLogRepository;