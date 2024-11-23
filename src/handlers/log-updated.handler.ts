import { Injectable, Logger } from '@nestjs/common';
import { LogUpdatedEvent } from '../events/log-updated.event';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';

@Injectable()
export class LogUpdatedHandler {
	constructor(
		private readonly logRepo: ConditioningLogRepo,
		private readonly logger: Logger
	) {}

	async handle(event: LogUpdatedEvent): Promise<void> {
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`Log ${logDTO.entityId} updated.`);
	}
}