import { DataPoint } from "@evelbulgroz/time-series";
import { TrainingLogSeries } from "@evelbulgroz/fitnessapp-base";
import { ConditioningLog } from "./conditioning-log.entity.js";
import { ConditioningLogDTO } from "../dtos/conditioning-log.dto.js";

/** A time series of conditioning logs
 * @remark May include activities of different types, or just a single type. In the latter case, the activityId and label properties should be set.
 */
export interface ConditioningLogSeries<T extends ConditioningLog<T,U>, U extends ConditioningLogDTO> extends TrainingLogSeries<ConditioningLog<T,U>, U> {
	/* The unit of the data (may be primitive, or name of class or interface) */
    unit: string;
	
	/**The data points in the log series */
    data: DataPoint<T>[];
}

export default ConditioningLogSeries;