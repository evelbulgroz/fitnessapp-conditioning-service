import { EntityUndeletedEvent } from '@evelbulgroz/ddd-base';

import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogUndeletedEventDTO } from './conditioning-log-undeleted.event.dto';

/** Conditioning log deleted domain event
 * @remarks Dispatched when a conditioning log is deleted from the repository
 */
export class ConditioningLogUndeletedEvent extends EntityUndeletedEvent<ConditioningLogUndeletedEventDTO, Partial<ConditioningLogDTO>> {
	constructor(dto: ConditioningLogUndeletedEventDTO) {
		super(dto);
	}
}

export default ConditioningLogUndeletedEvent;