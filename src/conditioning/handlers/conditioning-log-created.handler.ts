import { Injectable } from '@nestjs/common';

//import { Logger } from '@evelbulgroz/logger';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogCreatedEvent } from '../events/conditioning-log-created.event';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from '../../shared/handlers/domain-event.handler';
/** Handler for entity created event from ConditioningLog repository
 * @remark Placeholder: logs are added to to log service cache when added to user, so this handler may not be necessary
 * @todo Reintroduce logging after deciding on logging strategy
 */
@Injectable()
export class ConditioningLogCreatedHandler extends DomainEventHandler<ConditioningLogCreatedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		//private readonly logger: Logger
	) {
		super();
		void this.logRepo; // avoid unused variable warning
	}

	public async handle(event: ConditioningLogCreatedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		//const logDTO = event.payload;
		// Handle the log update event
		//this.logger.log(`Log ${logDTO.entityId} created.`);
	}
}

export default ConditioningLogCreatedHandler;