import { EntityDeletedEventDTO } from "@evelbulgroz/ddd-base";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";

export interface ConditioningLogCreatedEventDTO extends EntityDeletedEventDTO<ConditioningLogDTO> {
	// Add custom properties here
}

export default ConditioningLogCreatedEventDTO;
