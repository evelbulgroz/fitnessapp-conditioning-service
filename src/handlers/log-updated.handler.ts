import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { firstValueFrom, Observable } from 'rxjs';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { LogUpdatedEvent } from '../events/log-updated.event';
import { DomainEventHandler } from './domain-event.handler';

/** Log updated event handler
 * @remark Handles updating logs in log service cache, triggered by update events from log repository
 */
@Injectable()
export class LogUpdatedHandler extends DomainEventHandler<LogUpdatedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) private readonly logService: ConditioningDataService,
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
	}

	public async handle(event: LogUpdatedEvent): Promise<void> {
		const logDTO = event.payload;
		
		// fetch log from repo
		const logResult = await this.logRepo.fetchById(logDTO.entityId!);
		if (logResult.isFailure) {
			this.logger.error(`LogUpdatedHandler: Error fetching log from repo: ${logResult.error}`);
			return;
		}
		const log$ = logResult.value as Observable<ConditioningLog<any, ConditioningLogDTO>>;
		const log = await firstValueFrom(log$);

		// update cache with updated log
		const snapshot = this.logService.getCacheSnapshot(this);
		const cacheEntry = snapshot.find((entry) => entry.logs.some((log) => log.entityId === logDTO.entityId));
		if (cacheEntry) {
			const logIndex = cacheEntry.logs.findIndex((log) => log.entityId === logDTO.entityId);
			cacheEntry.logs[logIndex] = log;
			this.logService.updateCache([...snapshot], this);
		}
		else {
			this.logger.warn(`LogUpdatedHandler: Log ${logDTO.entityId} not found in cache`);
		}
	}
}

export default LogUpdatedHandler;