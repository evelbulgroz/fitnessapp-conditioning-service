import { EntityDeletedEventDTO } from "@evelbulgroz/ddd-base";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";

export interface LogCreatedEventDTO extends EntityDeletedEventDTO<ConditioningLogDTO> {
	// Add custom properties here
}

export default LogCreatedEventDTO;
