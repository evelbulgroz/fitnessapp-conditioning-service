import { Entity, EntityDTO, EntityId, EntityMetadataDTO, EntityPersistenceDTO } from "@evelbulgroz/ddd-base";
import { IsArray, IsDefined, IsInstanceOfOneOf, IsInstanceOfOneOfAll, IsNotEmpty } from '@evelbulgroz/sanitizer-decorator';

import { UserDTO } from "../dtos/user.dto";
import { UserPersistenceDTO } from "../dtos/user-persistence.dto";

/** A human user of the system, e.g. a coach or an athlete, with logs of conditioning activities
 * @remark Shallow implementation intended only to hold associations between users and logs
 * @remark User microservice is responsible for managing base user data, e.g. name, email, etc., and should be used as the only source of this information
 * @remark Could have used User as ddd aggregate root for logs, but opted for the flexibility of managing association separately
 * @remark This also allows log and user entities and repos to have more focused responsibilities
 * @remark To make this work, log data service has responsibility for keeping associations in sync
 * @remark References logs by id only, so cannot annotate them as soft deleted:
 * @remarj soft deleted logs should be retained in the user's logs array to maintain referential integrity.
 * @remark Only hard deleted logs should be removed from the user's logs array.
 */
export class User extends Entity<User, UserDTO> {
	//----------------------------- PROPERTIES ------------------------------//

	private _logs: EntityId[]; // holds log ids only, not the actual log entities
	private _userId: EntityId;
	
	//----------------------------- CONSTRUCTOR -----------------------------//	
	
	protected constructor(dto: UserDTO, metaDataDTO?: EntityMetadataDTO, overview: boolean = true) {
		super(dto, metaDataDTO, overview);
		this.userId = dto.userId; // invoke setters to activate validation
		this.logs = dto.logs ?? [];
	}

	//----------------------------- PUBLIC API -----------------------------//

	/** Adds a log to the user */
	public addLog(log: EntityId): void {
		this._logs.push(log); // bypass immutable getter to actually add the log to the private array
	}

	/** Removes a log from the user
	 * @param log The id of the log to remove
	 * @returns void
	 * @remark Does nothing if the log is not found
	 * @remark Should only be called to remove logs that have been hard deleted:
	 * @remark Soft deleted logs should be retained in the user's logs array to maintain referential integrity
	 */
	public removeLog(log: EntityId): void {
		this._logs = this._logs.filter(id => id !== log); // bypass immutable getter to actually remove the log from the private array
	}

	// updateLog() not needed because we're only holding primitive log ids

	//----------------------- ENTITY METHOD OVERRIDES -----------------------//

	public clone(includeId?: boolean, includeMetaData?: boolean): User {
		const clone = super.clone(includeId, includeMetaData) as User;
		clone.userId = this.userId;
		clone.logs = [...this.logs]; // shallow copy
		return clone;
	}
	
	public equals(other: User, compareIds: boolean = false, compareRefs: boolean = true): boolean {
		// use long chain of if statements to facilitate debugging
		
		// super returns false if other is undefined, null or wrong type, so no need to test for that
		if(!super.equals(other, compareIds, compareRefs)) {
			return false;
		}
		if (this.userId !== other.userId) {
			return false;
		}
		if (this.logs.length !== other.logs.length) {
			return false;
		}
		// logs are stored as ids only, so we can compare by value
		if (!this.logs.every((logId) => other.logs.find((otherLogId) => logId === otherLogId) !== undefined)) {
			return false;
		}
		return true;
	}

	public toDTO(): UserDTO {
		return {
			...super.toDTO(), // copy props from superclass
			userId: this.userId,
			logs: [...this.logs] // shallow copy
		};
	}

	public toPersistenceDTO(): UserPersistenceDTO {
		return super.toPersistenceDTO() as UserPersistenceDTO;
	}

	//----------------------------- PROPERTIES -----------------------------//
	
	/** The logs for the user
	 * @throws Error if logs is not an array of strings or numbers
	 * @remark To keep thing simple and decoupled, holds logs by id only, not the actual log entities.
	 * @remark It is the responsibility of the data service to keep the logs in sync with the user and to serve the actual log entities
	 */
	@IsDefined(undefined, { message: 'Logs must be defined' })
	@IsArray({ message: 'Logs must be an array' })
	@IsInstanceOfOneOfAll([String, Number], { message: 'Logs must be an array of strings or numbers' })
	public set logs(value: EntityId[]) {
		// do local validation here because we don't have a validator for this yet (isInstanceOfOneOfAll)
		if (value.some(id => typeof id !== 'string' && typeof id !== 'number')) {
			throw new Error('Logs must be an array of strings or numbers');
		}
		this._logs = [...value]; // shallow copy
	}
	public get logs(): EntityId[] { return [...this._logs]; } // shallow copy
	
	/** The user's id in the user microservice
	 * @remark EntityId managed by repo is not the same as the user id in the user microservice, which should be used for requests
	 * @remark Therefore, this property is necessary to support requests by user id
	 * @remark Service is responsible for keeping this unique and in sync with the user id in the user microservice
	 */
	@IsDefined(undefined, { message: 'User id must be defined' })
	@IsInstanceOfOneOf([String, Number], { message: 'User id must be a string or number' })
	@IsNotEmpty({ message: 'User id cannot be empty' })
	public set userId(value: EntityId) { this._userId = value; }
	public get userId(): EntityId { return this._userId; }	
}