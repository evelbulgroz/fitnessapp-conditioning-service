import { EntityUpdatedEvent } from "@evelbulgroz/ddd-base";

import { ConditioningLogDTO } from "../dtos/domain/conditioning-log.dto";
import { LogUpdatedEventDTO } from "./log-updated.event.dto";

/** Conditioning log updated domain event */
export class LogUpdatedEvent extends EntityUpdatedEvent<LogUpdatedEventDTO, Partial<ConditioningLogDTO>> {
	constructor(dto: LogUpdatedEventDTO) {
		super(dto);
	}
}