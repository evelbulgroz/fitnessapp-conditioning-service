import { Injectable } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from './domain-event.handler';
import { User } from '../domain/user.entity';
import { UserDeletedEvent } from '../events/user-deleted.event'
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';;

/** User deleted event handler
 * @remark Placeholder: implement user deletion event handling when user deletion is implemented
 */
@Injectable()
export class UserDeletedHandler extends DomainEventHandler<UserDeletedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository,
		private readonly logger: Logger
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