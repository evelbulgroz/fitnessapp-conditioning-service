import { EntityUpdatedEventDTO } from "@evelbulgroz/ddd-base";

import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";

export interface ConditioningLogUpdatedEventDTO extends EntityUpdatedEventDTO<Partial<ConditioningLogDTO>> {
	// Add custom properties here
}

export default ConditioningLogUpdatedEventDTO;