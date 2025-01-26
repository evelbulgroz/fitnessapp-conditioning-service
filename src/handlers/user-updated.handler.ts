import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { firstValueFrom, Observable } from 'rxjs';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from './domain-event.handler';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserRepository } from '../repositories/user.repo';

/** Handler for entity updated event from User repository
 * @remark Handles addition and removal of logs from log service cache entry for user, triggered by update events from user repository
 * @remark Users hold log ids, not logs themselves, so this handler does not handle log content updates
 * @remark Users currently hold no other state that would require cache updates, so this handler only updates logs
 */
@Injectable()
export class UserUpdatedHandler extends DomainEventHandler<UserUpdatedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) private readonly logService: ConditioningDataService, // forwardRef to avoid circular dependency
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger,
		private readonly userRepo: UserRepository,		
	) {
		super();
		void this.logService, this.logRepo, this.userRepo, this.logger; // avoid unused variable warning
	}

	public async handle(event: UserUpdatedEvent): Promise<void> {
		// get existing entry from cache snapshot
		const userDTO = event.payload as UserDTO;
		const snapshot = this.logService.getCacheSnapshot(this);
		const cacheEntry = snapshot.find(entry => entry.userId === userDTO.userId);
		if (cacheEntry) {
			const cachedLogs = cacheEntry.logs;
			// filter out logs that are no longer included in user DTO
			const includedLogs = cachedLogs.filter((log) => userDTO!.logs!.includes(log.entityId!));
			
			// find logs that are included in user DTO but not in cache
			const cachedLogIds = cachedLogs.map(log => log.entityId);
			const addedLogIds = userDTO.logs!.filter(logId => !cachedLogIds.includes(logId));
			const addedLogs = [];
			for (const logId of addedLogIds) {
				const result = await this.logRepo.fetchById(logId);
				if (result.isFailure) {
					this.logger.error(`${this.constructor.name}: Error fetching log ${logId} for user ${userDTO.userId}: ${result.error}`);
				}
				else {
					const log = await firstValueFrom(result.value as Observable<ConditioningLog<any, ConditioningLogDTO>>);
					if (log) {
						void addedLogs.push(log);
					}
				}
			}

			// update cache entry with included and added logs
			cacheEntry.logs = includedLogs.concat(addedLogs);
			cacheEntry.lastAccessed = new Date(); // update last accessed timestamp

			// update cache with shallow copy to trigger subscribers
			this.logService.updateCache([...snapshot], this);

			// log update
			this.logger.log(`${this.constructor.name}: User ${userDTO.userId} logs updated in cache.`);
		}
		else {
			this.logger.error(`${this.constructor.name}: User ${userDTO.userId} not found in cache.`);
		}

		// implicitly return Promise.resolve(void)
	}
}

export default UserUpdatedHandler;