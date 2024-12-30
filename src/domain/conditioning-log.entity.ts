import { EntityMetadataDTO } from "@evelbulgroz/ddd-base";
import { IsArray, IsLikeAll } from '@evelbulgroz/sanitizer-decorator';
import { Quantity } from '@evelbulgroz/quantity-class';
import { TrainingLog } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLap } from "./conditioning-lap.model";
import { ConditioningLapDTO } from "src/dtos/domain/conditioning-lap.dto";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import ConditioningLogPersistenceDTO from "src/dtos/domain/conditioning-log-persistence.dto";


/**@description A concrete log of a conditioning activity, e.g. a bike ride, a swim, a run etc.
 * @template T The type of the log, e.g. ConditioningLog
 * @template U The type of the DTO, e.g. ConditioningLogDTO
 * @see {@link TrainingLog} for most of the class members, this class only adds the concept of laps
 * @see {@link ConditioningLap} for details of a lap
 * @remark Laps are not included if log is an overview
 */
export class ConditioningLog<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLog<T, U> {
	//----------------------------- PROPERTIES ------------------------------//

	private _laps?: ConditioningLap[] | undefined;
	
	//----------------------------- CONSTRUCTOR -----------------------------//	
	
	/** Creates a new instance of ConditioningLog
	 * @param dto The data transfer object used to create the entity, should include entity ID
	 * @param metadataDTO Optional metadata for the entity (for use when re-serializing from JSON).
	 * @param overview True if this is an overview of the activity, false if this is a detailed log of the activity (default: true).
	 * @remark Follows the Entity pattern of having a protected constructor and a public static create() method.
	 * @remark Defaulting to overview economizes on resources, e.g. storage, memory or bandwidth, as e.g. sensor logs may become very large.
	 * @remark This also ensures that we can rely on default Entity.create() behavior, e.g. when initializing logs from persistence.
	 * @remark Details can be fetched on demand, e.g. when user drills down into the activity, or when the user requests a detailed report.
	 * @remark Laps are not included if log is an overview.
	 */
	protected constructor(dto: U, metadataDTO: EntityMetadataDTO, overview: boolean = true) {
		super(dto, metadataDTO, overview);
		if (!overview) { // not overview, so populate laps
			this.laps = dto.laps
			?
			dto.laps?.map(lapDTO => {  // DTO has laps, map to ConditioningLap
				return {
					start: (new Date(lapDTO.start)) as Date,
					end: lapDTO.end !== undefined ? new Date(lapDTO.end) as Date : undefined,
					duration: lapDTO.duration && new Quantity(lapDTO.duration),
					note: lapDTO.note
				}
			})
			:
			[]; // no laps, so assign empty array			
		} // else implicitly assign undefined to laps

		// assign any additional props to setters to activate validation decorators		
	}

	//----------------------------- PUBLIC API -----------------------------//

	public equals(other: ConditioningLog<T,U>, compareIds: boolean = false, compareRefs: boolean = true): boolean {
		// use long chain of if statements to facilitate debugging
		
		// super returns false if other is undefined, null or wrong type, so no need to test for that
		if(!super.equals(other, compareIds, compareRefs)) { //console.log('super.isEqual() failed');
			return false;
		}
		// laps are shallow copied on assignment, so no need to test for reference equality
		else if (!this.isOverview && JSON.stringify(this.laps) !== JSON.stringify(other.laps)) { //console.log('laps values are not equal');
			// NOTE: cheap comparison by value, but ok for now
			return false;
		}
		return true;
	}

	public toDTO(): U {
		return {
			...super.toDTO(), // copy props from superclass(es)
			laps: this.laps?.map(lap => JSON.parse(JSON.stringify(lap)) as ConditioningLapDTO) // serialize lap data
		} as U;
	}

	public toJSON(): ConditioningLogPersistenceDTO<U, EntityMetadataDTO> {
		const json: Record<string,any> =  {
			...super.toJSON(), // copy props from superclass
			...this.toDTO() // copy props from this class			
		};

		// remove props with undefined values
		void Object.keys(json).map(key => json[key] === undefined && delete json[key]);

		return json as ConditioningLogPersistenceDTO<U, EntityMetadataDTO>;
		
	}

	//----------------------------- PROPERTIES -----------------------------//
	
	/** Data from any laps in the session. A lap is a segment of a session, e.g. a lap in a pool/around a track, or a segment of a bike ride. */
	@IsArray({ allowUndefined: true })
	@IsLikeAll({ start: new Date() }, { strict: false })
	public set laps(value: ConditioningLap[] | undefined) { this._laps = value ? [...value] : undefined; }	
	public get laps(): ConditioningLap[] | undefined { return this._laps ? [...this._laps] : undefined 	}
	}

TrainingLog.registerSubclass(ConditioningLog); // populate subclass map in superclass to enable deserialization