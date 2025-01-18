import { EntityUndeletedEventDTO } from "@evelbulgroz/ddd-base";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";

export interface ConditioningLogUndeletedEventDTO extends EntityUndeletedEventDTO<Partial<ConditioningLogDTO>> {
	// Add custom properties here
}

export default ConditioningLogUndeletedEventDTO;
