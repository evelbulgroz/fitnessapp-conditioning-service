import { EntityId } from "@evelbulgroz/ddd-base";
import { IsArray, IsLikeAll } from '@evelbulgroz/sanitizer-decorator';
import { Quantity } from '@evelbulgroz/quantity-class';
import { TrainingLog } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { ConditioningLap } from "./conditioning-lap.model";

/**@description A concrete log of a conditioning activity, e.g. a bike ride, a swim, a run etc.
 * @template T The type of the log, e.g. ConditioningLog
 * @template U The type of the DTO, e.g. ConditioningLogDTO
 * @see {@link TrainingLog} for most of the class members, this class only adds the concept of laps
 * @see {@link ConditioningLap} for details of a lap
 * @note Laps are not included if log is an overview
 */
export class ConditioningLog<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLog<T, U> {
	//----------------------------- PROPERTIES ------------------------------//

	private _laps?: ConditioningLap[] | undefined;
	
	//----------------------------- CONSTRUCTOR -----------------------------//	
	
	protected constructor(dto: ConditioningLogDTO, id?: EntityId, createdOn?: Date, updatedOn?: Date, overview: boolean = true) {
		super(dto, id, createdOn, updatedOn, overview);
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

	public toJSON(): U {
		return {
			...super.toJSON(), // copy props from superclass
			laps: this.laps && JSON.parse(JSON.stringify(this.laps)) // deep copy on the cheap
		};
	}

	//----------------------------- PROPERTIES -----------------------------//
	
	/** Data from any laps in the session. A lap is a segment of a session, e.g. a lap in a pool/around a track, or a segment of a bike ride. */
	@IsArray({ allowUndefined: true })
	@IsLikeAll({ start: new Date() }, { strict: false })
	public set laps(value: ConditioningLap[] | undefined) { this._laps = value ? [...value] : undefined; }	
	public get laps(): ConditioningLap[] | undefined { return this._laps ? [...this._laps] : undefined 	}
	}

TrainingLog.registerSubclass(ConditioningLog); // populate subclass map in superclass to enable deserialization