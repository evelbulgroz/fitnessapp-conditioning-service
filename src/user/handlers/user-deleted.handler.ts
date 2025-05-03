import { Injectable } from '@nestjs/common';

import { StreamLoggableMixin } from '../../libraries/stream-loggable';

import ConditioningLog from '../../conditioning/domain/conditioning-log.entity';
import ConditioningLogDTO from '../../conditioning/dtos/conditioning-log.dto';
import ConditioningLogRepository from '../../conditioning/repositories/conditioning-log.repo';
import DomainEventHandler from '../../shared/handlers/domain-event.handler';
import UserDeletedEvent from '../events/user-deleted.event'
import UserRepository from '../repositories/user.repo';;

/** Handler for entity deleted event from User repository
 * @remark Placeholder: implement user deletion event handling when user deletion is implemented
 */
@Injectable()
export class UserDeletedHandler extends StreamLoggableMixin(DomainEventHandler<UserDeletedEvent>) {
	constructor(
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository,
	) {
		super();
		void this.logRepo, this.userRepo; // avoid unused variable warning
	}

	public async handle(event: UserDeletedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`User ${logDTO.entityId} deleted.`);
	}
}

export default UserDeletedHandler;