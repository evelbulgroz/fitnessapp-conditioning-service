import { EntityDeletedEventDTO } from "@evelbulgroz/ddd-base";
import { ConditioningLogDTO } from "../dtos/conditioning-log.dto";

export interface ConditioningLogDeletedEventDTO extends EntityDeletedEventDTO<Partial<ConditioningLogDTO>> {
	// Add custom properties here
}

export default ConditioningLogDeletedEventDTO;
