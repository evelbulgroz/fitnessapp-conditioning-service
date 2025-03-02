import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { firstValueFrom, Observable } from 'rxjs';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../../conditioning/services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../../conditioning/domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../../conditioning/repositories/conditioning-log.repo';
import { DomainEventHandler } from '../../shared/handlers/domain-event.handler';
import { User } from '../domain/user.entity';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserDTO } from '../dtos/user.dto';
import { UserRepository } from '../repositories/user.repo';

/** Handler for entity created event from User repository
 * @remark Handles addition and log population of user in log service cache, triggered by creation events from user repository
 */
@Injectable()
export class UserCreatedHandler extends DomainEventHandler<UserCreatedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) private readonly logService: ConditioningDataService, // forwardRef to avoid circular dependency
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository,
		private readonly logger: Logger
	) {
		super();
		void this.logRepo, this.userRepo; // avoid unused variable warning
	}

	public async handle(event: UserCreatedEvent): Promise<void> {
		// create user entity from dto
		const userDTO = event.payload as UserDTO;
		const userResult = User.create(
			userDTO,
			{ createdOn: event.occurredOn }
			// constructor sets logs from dto, so no need to pass them here
		);
		if (userResult.isFailure) {
			this.logger.error(`${this.constructor.name}: Error creating user ${userDTO.entityId}: ${userResult.error}`);
			return;
		}
		const user = userResult.value as unknown as  User;

		// populate logs for user and update cache
		const snapshot = this.logService.getCacheSnapshot(this);
		const cacheEntry = snapshot.find((entry) => entry.userId === user.userId);
		if (cacheEntry) {
			const logIds = user.logs;
			const logs = [];
			for (const logId of logIds) {
				const result = await this.logRepo.fetchById(logId);
				if (result.isFailure) {
					this.logger.error(`${this.constructor.name}: Error fetching log ${logId} for user ${user.userId}: ${result.error}`);
				}
				else {
					const log$ = result.value as Observable<ConditioningLog<any, ConditioningLogDTO>>;
					const log = await firstValueFrom(log$);
					if (log) {
						void logs.push(log);
					}
				}
			}

			cacheEntry.logs = logs;
			cacheEntry.lastAccessed = new Date();

			// update cache with new entry
			this.logService.updateCache([...snapshot], this);
		}
		else {
			this.logger.error(`${this.constructor.name}: Cache entry not found for user ${user.userId}`);
		}
	}
}

export default UserCreatedHandler;