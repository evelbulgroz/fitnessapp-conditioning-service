import { EntityDeletedEvent } from '@evelbulgroz/ddd-base';

import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { LogDeletedEventDTO } from './log-deleted.event.dto';

/** Conditioning log deleted domain event
 * @remarks Dispatched when a conditioning log is deleted from the repository
 */
export class LogDeletedEvent extends EntityDeletedEvent<LogDeletedEventDTO, Partial<ConditioningLogDTO>> {
	constructor(dto: LogDeletedEventDTO) {
		super(dto);
	}
}

export default LogDeletedEvent;