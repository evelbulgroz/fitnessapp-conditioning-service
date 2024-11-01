
import { Entity, EntityId } from "@evelbulgroz/ddd-base";
import { IsArray, IsDefined, IsInstanceOfOneOf, IsInstanceOfOneOfAll } from '@evelbulgroz/sanitizer-decorator';

import UserDTO from "../dtos/user.dto.js";

/** A human user of the system, e.g. a coach or an athlete, with logs of conditioning activities
 * @remarks Shallow implementation intended only to hold associations between users and logs
 * @remarks Could have used User as ddd aggregate root for logs, but opted for the flexibility of managing association separately
 * @remarks This also allows log and user entities and repos to have more focused responsibilities
 * @remarks To make this work, data service has responsibility for keeping associations in sync
 */
export class User extends Entity<any, UserDTO> {
	//----------------------------- PROPERTIES ------------------------------//

	private _logs: EntityId[]; // holds log ids only, not the actual log entities
	private _userId: EntityId;
	
	//----------------------------- CONSTRUCTOR -----------------------------//	
	
	protected constructor(dto: UserDTO, id?: EntityId, createdOn?: Date, updatedOn?: Date, overview: boolean = true) {
		super(dto, id, createdOn, updatedOn, overview);
		this.userId = dto.userId; // invoke setters to activate validation
		this.logs = dto.logs ?? [];
	}

	//----------------------------- PUBLIC API -----------------------------//

	/** Adds a log to the user */
	public addLog(log: EntityId): void {
		this._logs.push(log); // bypass immutable getter to actually add the log to the private array
	}

	/** Removes a log from the user */
	public removeLog(log: EntityId): void {
		this._logs = this._logs.filter(id => id !== log); // bypass immutable getter to actually remove the log from the private array
	}

	// updateLog() not needed because we're only holding primitive log ids
	
	public equals(other: User, compareIds: boolean = false, compareRefs: boolean = true): boolean {
		// use long chain of if statements to facilitate debugging
		
		// super returns false if other is undefined, null or wrong type, so no need to test for that
		if(!super.equals(other, compareIds, compareRefs)) { //console.log('super.isEqual() failed');
			return false;
		}
		if (this.userId !== other.userId) { //console.log('userId not equal');
			return false;
		}
		if (this.logs.length !== other.logs.length) { //console.log('logs.length not equal');
			return false;
		}
		// NOTE: Logs are stored as ids only, so we can compare by value
		if (!this.logs.every((log, index) => log === other.logs[index])) { //console.log('logs not equal');
			return false;
		}
		return true;
	}

	public toJSON(): UserDTO {
		return {
			...super.toJSON(), // copy props from superclass
			userId: this.userId,
			logs: [...this.logs] // shallow copy
		};
	}

	//----------------------------- PROPERTIES -----------------------------//
	
	/** The logs for the user
	 * @throws Error if logs is not an array of strings or numbers
	 * @remarks To keep thing simple and decopuled, holds logs by id only, not the actual log entities.
	 * @remarks It is the responsibility of the data service to keep the logs in sync with the user and to serve the actual log entities
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
	
	/** @description The user's id in the user microservice
	 * @remarks EntityId managed by repo is not the same as the user id in the user microservice, which should be used for requests
	 * @remarks Therefore, this property is necessary to support requests by user id
	 * @remarks Service is responsible for keeping this unique and in sync with the user id in the user microservice
	 */
	@IsInstanceOfOneOf([String, Number], { message: 'User id must be a string or number' })
	public set userId(value: EntityId) { this._userId = value; }
	public get userId(): EntityId { return this._userId; }	
}