import { EntityCreatedEvent } from '@evelbulgroz/ddd-base';

import LogCreatedEventDTO from './log-created.event.dto';
import ConditioningLogDTO from '../dtos/domain/conditioning-log.dto';

/** Conditioning log created domain event */
export class LogCreatedEvent extends EntityCreatedEvent<LogCreatedEventDTO, ConditioningLogDTO> {
	constructor(dto: LogCreatedEventDTO) {
		super(dto);
	}
}

export default LogCreatedEvent;