import { EntityDeletedEventDTO } from "@evelbulgroz/ddd-base";
import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";

export interface LogDeletedEventDTO extends EntityDeletedEventDTO<Partial<ConditioningLogDTO>> {
	// Add custom properties here
}

export default LogDeletedEventDTO;
