import { Injectable, Logger } from '@nestjs/common';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { EventHandler } from './event.handler';
import { LogDeletedEvent } from '../events/log-deleted.event';

/** Log updated event handler */
@Injectable()
export class LogDeletedHandler extends EventHandler<LogDeletedEvent> {
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