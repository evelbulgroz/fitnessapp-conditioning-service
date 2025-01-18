import { EntityCreatedEvent } from '@evelbulgroz/ddd-base';

import ConditioningLogCreatedEventDTO from './conditioning-log-created.event.dto';
import ConditioningLogDTO from '../dtos/domain/conditioning-log.dto';

/** Conditioning log created domain event
 * @remarks Dispatched when a conditioning log is created in the repository
 */
export class ConditioningLogLogCreatedEvent extends EntityCreatedEvent<ConditioningLogCreatedEventDTO, ConditioningLogDTO> {
	constructor(dto: ConditioningLogCreatedEventDTO) {
		super(dto);
	}
}

export default ConditioningLogLogCreatedEvent;