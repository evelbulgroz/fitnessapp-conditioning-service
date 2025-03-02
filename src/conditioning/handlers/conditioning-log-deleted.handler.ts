import { Injectable } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDeletedEvent } from '../events/conditioning-log-deleted.event';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from '../../shared/handlers/domain-event.handler';

/** Handler for entity deleted event from ConditioningLog repository
 * @remark Placeholder: logs are removed from log service cache when removed from user, so this handler may not be necessary
 */
@Injectable()
export class ConditioningLogDeletedHandler extends DomainEventHandler<ConditioningLogDeletedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
	}

	public async handle(event: ConditioningLogDeletedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`Log ${logDTO.entityId} deleted.`);
	}
}

export default ConditioningLogDeletedHandler;