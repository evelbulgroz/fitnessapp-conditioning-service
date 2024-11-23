import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { firstValueFrom, Observable } from 'rxjs';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from './domain-event.handler';
import { User } from '../domain/user.entity';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserRepository } from '../repositories/user.repo';

/** User updated event handler */
@Injectable()
export class UserUpdatedHandler extends DomainEventHandler<UserUpdatedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) private readonly logService: ConditioningDataService,
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger,
		private readonly userRepo: UserRepository<User, UserDTO>,		
	) {
		super();
		void this.logService, this.logRepo, this.userRepo, this.logger; // avoid unused variable warning
	}

	public async handle(event: UserUpdatedEvent): Promise<void> {
		throw new Error('Method not implemented.');
		/*
		const userDTO = event.payload as UserDTO;
		// bug: 'this' refers to data service where code is copied from
		// need to find other way to access userLogsSubject in data service
		const cacheEntry = this.userLogsSubject.value.find((entry) => entry.userId === userDTO.userId);
		if (cacheEntry) {
			const cachedLogs = cacheEntry.logs;
			// filter out logs that are no longer included in user DTO
			const includedLogs = cachedLogs.filter((log) => userDTO!.logs!.includes(log.entityId!));
			
			// fetch logs that are included in user DTO but not in cache
			const cachedLogIds = cachedLogs.map((log) => log.entityId);
			const addedLogIds = userDTO.logs!.filter((logId) => !cachedLogIds.includes(logId));
			const addedLogs = [];
			for (const logId of addedLogIds) {
				//console.debug('fetching log:', logId);
				const result = await this.logRepo.fetchById(logId);
				if (result.isFailure) {
					this.logger.error(`${this.constructor.name}: Error fetching log ${logId} for user ${userDTO.userId}: ${result.error}`);
				}
				else {
					const log = await firstValueFrom(result.value as Observable<ConditioningLog<any, ConditioningLogDTO>>);
					if (log) {
						//console.debug('fetched log:', log.entityId);
						void addedLogs.push(log);
					}
				}
			}
			
			// update cache entry with included and added logs
			cacheEntry.logs = includedLogs.concat(addedLogs);
			cacheEntry.lastAccessed = new Date(); // update last accessed timestamp

			// update cache with shallow copy to trigger subscribers
			this.userLogsSubject.next([...this.userLogsSubject.value]);
			this.logger.log(`${this.constructor.name}: User ${userDTO.userId} logs updated in cache.`);
		}
			*/
	}
}

export default UserUpdatedHandler;