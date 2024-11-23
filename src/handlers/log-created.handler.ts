import { Injectable, Logger } from '@nestjs/common';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { EventHandler } from './event.handler';
import { LogCreatedEvent } from '../events/log-created.event';

/** Log updated event handler */
@Injectable()
export class LogCreatedHandler extends EventHandler<LogCreatedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
		void this.logRepo; // avoid unused variable warning
	}

	public async handle(event: LogCreatedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`Log ${logDTO.entityId} created.`);
	}
}

export default LogCreatedHandler;