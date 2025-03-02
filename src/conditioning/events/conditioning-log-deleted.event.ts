import { EntityDeletedEvent } from '@evelbulgroz/ddd-base';

import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { ConditioningLogDeletedEventDTO } from './conditioning-log-deleted.event.dto';

/** Conditioning log deleted domain event
 * @remarks Dispatched when a conditioning log is deleted from the repository
 */
export class ConditioningLogDeletedEvent extends EntityDeletedEvent<ConditioningLogDeletedEventDTO, Partial<ConditioningLogDTO>> {
	constructor(dto: ConditioningLogDeletedEventDTO) {
		super(dto);
	}
}

export default ConditioningLogDeletedEvent;