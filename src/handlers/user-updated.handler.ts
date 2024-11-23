import { Injectable, Logger } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { EventHandler } from './event.handler';
import { User } from '../domain/user.entity';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserRepository } from '../repositories/user.repo';

/** User updated event handler */
@Injectable()
export class UserUpdatedHandler extends EventHandler<UserUpdatedEvent> {
	constructor(
		private readonly userRepo: UserRepository<User, UserDTO>,
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
		void this.logRepo, this.userRepo, this.logger; // avoid unused variable warning
	}

	public async handle(event: UserUpdatedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		/*const userDTO = event.payload;
		const cacheEntry = this.userRepo.getUserLogsCacheEntry(userDTO.userId);
		if (cacheEntry) {
			const cachedLogs = cacheEntry.logs;
			const includedLogs = cachedLogs.filter((log) => userDTO.logs.includes(log.entityId));
			const cachedLogIds = cachedLogs.map((log) => log.entityId);
			const addedLogIds = userDTO.logs.filter((logId) => !cachedLogIds.includes(logId));
			const addedLogs = [];

			for (const logId of addedLogIds) {
				const result = await this.logRepo.fetchById(logId);
				if (result.isFailure) {
					this.logger.error(`Error fetching log ${logId} for user ${userDTO.userId}: ${result.error}`);
				} else {
					const log = await firstValueFrom(result.value);
					if (log) {
						addedLogs.push(log);
					}
				}
			}

			cacheEntry.logs = includedLogs.concat(addedLogs);
			cacheEntry.lastAccessed = new Date();
			this.userRepo.updateUserLogsCacheEntry(cacheEntry);
			this.logger.log(`User ${userDTO.userId} logs updated in cache.`);
		}*/
	}
}

export default UserUpdatedHandler;