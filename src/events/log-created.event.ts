import { EntityCreatedEvent } from '@evelbulgroz/ddd-base';

import LogCreatedEventDTO from './log-created.event.dto';
import ConditioningLogDTO from '../dtos/domain/conditioning-log.dto';

/** Conditioning log created domain event
 * @remarks Dispatched when a conditioning log is created in the repository
 */
export class LogCreatedEvent extends EntityCreatedEvent<LogCreatedEventDTO, ConditioningLogDTO> {
	constructor(dto: LogCreatedEventDTO) {
		super(dto);
	}
}

export default LogCreatedEvent;