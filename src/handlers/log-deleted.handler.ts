import { Injectable } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from './domain-event.handler';
import { LogDeletedEvent } from '../events/log-deleted.event';

/** Log updated event handler
 * @remark Placeholder: logs are removed from log service cache when removed from user, so this handler may not be necessary
 */
@Injectable()
export class LogDeletedHandler extends DomainEventHandler<LogDeletedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
	}

	public async handle(event: LogDeletedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`Log ${logDTO.entityId} deleted.`);
	}
}

export default LogDeletedHandler;