import { Injectable, Logger } from '@nestjs/common';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { EventHandler } from './event.handler';
import { User } from '../domain/user.entity';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';
import e from 'express';

/** User created event handler */
@Injectable()
export class UserCreatedHandler extends EventHandler<UserCreatedEvent> {
	constructor(
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository<User, UserDTO>,
		private readonly logger: Logger
	) {
		super();
		void this.logRepo, this.userRepo; // avoid unused variable warning
	}

	public async handle(event: UserCreatedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		const logDTO = event.payload;
		// Handle the log update event
		this.logger.log(`User ${logDTO.entityId} created.`);
	}
}

export default UserCreatedHandler;