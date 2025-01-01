import { Inject, Injectable } from "@nestjs/common";

import { EntityFactory,	EntityMetadataDTO, Logger, PersistenceAdapter, Result } from "@evelbulgroz/ddd-base";
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { ConditioningLogPersistenceDTO } from "../dtos/domain/conditioning-log-persistence.dto";

/**@classdesc Concrete implementation of an injectable ConditioningLogRepo that uses an adapter to interact with a persistence layer */
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

	// NOTE: Public API methods are inherited from the base class
		
	//-------------------------- PROTECTED METHODS --------------------------//
	
	// initialize the repository
	// todo: retire when implemented in ddd-base library
	protected async initializePersistence(): Promise<Result<void>> {
			this.logger.log(`${this.constructor.name}: Initializing persistence...`);
			const initResult = await this.adapter.initialize();
			if (initResult.isFailure) {
				return Promise.resolve(Result.fail<void>(initResult.error));
			}
			this.logger.log(`${this.constructor.name}: Persistence initialized.`);
			return Promise.resolve(Result.ok<void>());
	}
	
	// populate cache from data directory (cache is populated with overviews only, load details on demand)
	// todo: retire when implemented in ddd-base library
	protected async populateEntityCache(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Populating cache...`);
		const result = await this.adapter.fetchAll();
		if (result.isFailure) {
			return Promise.resolve(Result.fail<void>(result.error));
		}
		const dtos = result.value as ConditioningLogPersistenceDTO<U, EntityMetadataDTO>[];
		const logs = dtos.map(dto => {
			const createResult = this.createEntityFromPersistenceDTO(dto, true);
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
	
	// todo: figure out a better way to handle imports
	protected async finalizeInitialization(): Promise<Result<void>> {
		this.logger.log(`${this.constructor.name}: Finalizing initialization...`);
		//await this.#subscribeToImportUpdates();
		// base class initialization logs completion
		return Promise.resolve(Result.ok<void>());
	}
	
	protected getEntityFromDTO(dto: U): T | undefined {
		let entity = this.getCachedEntityById(dto.entityId!);// try to find the entity by ID in the cache
		if (entity) { return entity as T; }
		return this.cache.value.find(e => { // try to find the entity by source ID in the cache
			// comparing primitives, so no need to serialize the entiry or deserialize the DTO
			return (e.meta?.sourceId?.id === dto.meta?.sourceId?.id && e.meta?.sourceId?.source === dto.meta?.sourceId?.source);
		}) as T | undefined;
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

	//----------------------- OTHER PROTECTED METHODS -----------------------//

	/* Create a new entity from a persistence DTO
	 * @param dto The persistence DTO to create the entity from
	 * @param overView If true, create an overview entity; otherwise, create a detailed entity
	 * @returns The new entity
	 * @throws Error if the entity class is unknown or unsupported
	 * @remark Exists to enable the generic creation of User entities from DTOs, while staying DRY
	 * @todo Remove when implemented in ddd-base library
	 */
	protected createEntityFromPersistenceDTO(dto: ConditioningLogPersistenceDTO<U, EntityMetadataDTO>, ...args: any[]): Result<T> {
		const factoryResult = this.getFactoryFromDTO(dto);
		if (factoryResult.isFailure) {
			return Result.fail<T>(`Unknown or unsupported entity type: ${dto.className}`);
		}
		const factory = factoryResult.value as EntityFactory<T, U>;

		const classResult = this.getClassFromDTO(dto);
		if (classResult.isFailure) {
			return Result.fail<T>(classResult.error);
		}
		const ClassRef = classResult.value as typeof ConditioningLog;				
		const metadataDTO = ClassRef.getMetaDataDTO(dto);
		
		const createResult = factory(dto, metadataDTO, ...args);
		if (createResult.isFailure) {
			return Result.fail<T>(`Failed to create entity: ${createResult.error}`);
		}

		// creation succeeded - return the new entity
		return Result.ok<T>(createResult.value as T);
	}
}

export default ConditioningLogRepository;