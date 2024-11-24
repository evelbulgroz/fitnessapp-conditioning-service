import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { DomainEventHandler } from './domain-event.handler';
import { User } from '../domain/user.entity';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';
import { firstValueFrom, Observable } from 'rxjs';

/** User created event handler */
@Injectable()
export class UserCreatedHandler extends DomainEventHandler<UserCreatedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) private readonly logService: ConditioningDataService,
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository<User, UserDTO>,
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
			userDTO.entityId,
			userDTO.createdOn ? new Date(userDTO.createdOn) : undefined,
			userDTO.updatedOn ? new Date(userDTO.updatedOn) : undefined,
			// constructor sets logs from dto, so no need to pass them here
		);
		if (userResult.isFailure) {
			this.logger.error(`${this.constructor.name}: Error creating user ${userDTO.entityId}: ${userResult.error}`);
			return;
		}
		const user = userResult.value as User;

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