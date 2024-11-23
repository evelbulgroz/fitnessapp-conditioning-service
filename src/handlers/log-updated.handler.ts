import { Injectable, Logger } from '@nestjs/common';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { LogUpdatedEvent } from '../events/log-updated.event';
import { EventHandler } from './event.handler';

/** Log updated event handler */
@Injectable()
export class LogUpdatedHandler extends EventHandler<LogUpdatedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
	}

	public async handle(event: LogUpdatedEvent): Promise<void> {
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`Log ${logDTO.entityId} updated.`);
	}
}