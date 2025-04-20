import { ConditioningLapDTO } from "./conditioning-lap.dto.js";
import { TrainingLogDTO } from "@evelbulgroz/fitnessapp-base";

export class ConditioningLogDTO extends TrainingLogDTO {
	/** Specifies a segment of a session, e.g. a lap in a pool/around a track, or a segment of a bike ride
	 * @remark May be empty if no laps, or undefined if this is an overview
	 * @see {@link TrainingLogDTO}
	 * @see {@link EntityDTO}
	 */
	laps?: ConditioningLapDTO[];
}

export default ConditioningLogDTO;