import { Injectable } from '@nestjs/common';

import { StreamLoggableMixin } from '../../libraries/stream-loggable';

import ConditioningLog from '../domain/conditioning-log.entity';
import ConditioningLogDeletedEvent from '../events/conditioning-log-deleted.event';
import ConditioningLogDTO from '../dtos/conditioning-log.dto';
import ConditioningLogRepository from '../repositories/conditioning-log.repo';
import DomainEventHandler from '../../shared/handlers/domain-event.handler';

/** Handler for entity deleted event from ConditioningLog repository
 * @remark Placeholder: logs are removed from log service cache when removed from user, so this handler may not be necessary
 */
@Injectable()
export class ConditioningLogDeletedHandler extends StreamLoggableMixin(DomainEventHandler<ConditioningLogDeletedEvent>) {
	constructor(
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
	) {
		super();
	}

	public async handle(event: ConditioningLogDeletedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		//const logDTO = event.payload;
		// Handle the log update event
		//this.logger.log(`Log ${logDTO.entityId} deleted.`);
	}
}

export default ConditioningLogDeletedHandler;