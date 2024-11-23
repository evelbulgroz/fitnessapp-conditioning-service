import { Injectable } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';


import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { LogUpdatedEvent } from '../events/log-updated.event';
import { DomainEventHandler } from './domain-event.handler';

/** Log updated event handler */
@Injectable()
export class LogUpdatedHandler extends DomainEventHandler<LogUpdatedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
	}

	public async handle(event: LogUpdatedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`Log ${logDTO.entityId} updated.`);
	}
}

export default LogUpdatedHandler;