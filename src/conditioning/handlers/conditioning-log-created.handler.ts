import { Injectable } from '@nestjs/common';

import { StreamLoggableMixin } from '../../libraries/stream-loggable';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogCreatedEvent } from '../events/conditioning-log-created.event';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from '../../shared/handlers/domain-event.handler';

/** Handler for entity created event from ConditioningLog repository
 * @remark Placeholder: logs are added to to log service cache when added to user, so this handler may not be necessary
 */
@Injectable()
export class ConditioningLogCreatedHandler extends StreamLoggableMixin(DomainEventHandler<ConditioningLogCreatedEvent>) {
	constructor(
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
	) {
		super();
		void this.logRepo; // avoid unused variable warning
	}

	public async handle(event: ConditioningLogCreatedEvent): Promise<void> {
		const logDTO = event.payload;
		// Handle the log update event (for now, do nothing)
		this.logger.log(`Log ${logDTO.entityId} created.`);
	}
}

export default ConditioningLogCreatedHandler;