import { EntityUpdatedEvent } from "@evelbulgroz/ddd-base";

import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { ConditioningLogUpdatedEventDTO } from "./conditioning-log-updated.event.dto";

/** Conditioning log updated domain event
 * @remarks Dispatched when a conditioning log is updated in the repository
 */
export class ConditioningLogUpdatedEvent extends EntityUpdatedEvent<ConditioningLogUpdatedEventDTO, Partial<ConditioningLogDTO>> {
	constructor(dto: ConditioningLogUpdatedEventDTO) {
		super(dto);
	}
}

export default ConditioningLogUpdatedEvent;