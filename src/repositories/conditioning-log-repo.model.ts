import { Injectable } from "@nestjs/common";

import { Observable } from "rxjs";

import { ConditioningLog } from "../domain/conditioning-log.entity";
import { ConditioningLogDTO } from "../dtos/conditioning-log.dto";
import { EntityId, Result } from "@evelbulgroz/ddd-base";
import { TrainingLogRepo } from "@evelbulgroz/fitnessapp-base";
import { Query } from "@evelbulgroz/query-fns";

/**@classdesc Describes and provides default features for any ConditioningLog repository
 * @remarks Exists mostly to enable clients to depend on abstractions rather than a specific implementations
 * @remarks Clients should inject this class and depend on the injector to provide the concrete implementation at runtime
 * @remarks NestJS's DI system cannot inject abstract classes, so this class is not marked abstract though it should be treated as such
 * @note Must be extended by a concrete class specific to a particular persistence layer
*/
@Injectable()
export class ConditioningLogRepo<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLogRepo<ConditioningLog<T,U>, U> {
	
	//--------------------------------- PUBLIC METHODS ---------------------------------
	
	//----------------------------------- PUBLIC STATIC METHODS -----------------------------------

	/** Get the class constructor from a class name
	 * @param className The name of the class to get
	 * @returns A Result wrapping the class constructor if successful, otherwise a failure result
	 * @remarks Exists to enable the generic creation of User entities from DTOs, while staying DRY
	 * @remarks Placeholder until base class is refactored to use a public static rather than a protected method
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
	


	/** Fetch entities by query criteria
	 * @param criteria The query criteria to use to filter entities
	 * @param matchAll If true, all criteria must match; otherwise, any criteria matching is sufficient
	 * @returns A Result wrapping an Observable of the entities matching the query criteria
	 * @remarks Exists to enforce use of ConditioningLogQueryCriteria, otherwise delegates to base class
	 */
	public async fetchByQuery(criteria: Query<any,any>, matchAll: boolean = false): Promise<Result<Observable<ConditioningLog<T,U>[]>>> {
		throw new Error("Method not implemented: implement in concrete subclass");
	}
	
	//--------------------------------- PLACEHOLDERS -------------------------------------

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