import { Inject, Injectable } from "@nestjs/common";

import { EntityMetadataDTO, Logger, PersistenceAdapter, Result } from "@evelbulgroz/ddd-base";
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { ConditioningLogPersistenceDTO } from "../dtos/domain/conditioning-log-persistence.dto";

/**@classdesc Concrete implementation of an injectable ConditioningLogRepo that uses an adapter to interact with a persistence layer
 * @template T The type of the log, e.g. ConditioningLog
 * @template U The type of the DTO, e.g. ConditioningLogDTO
 * @remark This class is a repository for ConditioningLog entities, and is intended to be injected into other classes, e.g. services.
 * @remark Implements a few method overrides but otherwise relies on the base class for most of its functionality.
 * @todo Emit custom CRUD events, as in the UserRepo
 */
@Injectable()
export class ConditioningLogRepository<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLogRepo<ConditioningLog<T,U>, U> {
	//------------------------------ CONSTRUCTOR ----------------------------//

	public constructor(
		protected readonly adapter: PersistenceAdapter<ConditioningLogPersistenceDTO<U, EntityMetadataDTO>>,
		protected readonly logger: Logger,
		@Inject('REPOSITORY_THROTTLETIME') throttleTime: number, // todo: maybe get this from config
	) {
		super(adapter, logger, throttleTime);
	}
	
	//------------------------------ PUBLIC API -----------------------------//

	// NOTE: Currently, base class public API is fully sufficient for this class
		
	//------------------- TEMPLATE METHOD IMPLEMENTATIONS -------------------//	
	
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
	
	//--------------------- PROTECTED METHOD OVERRIDES ----------------------//
	
	// todo: figure out a better way to handle imports
	/*
	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates();
		// base class initialization logs completion
		return Promise.resolve(Result.ok<void>());
	}
	*/
	
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