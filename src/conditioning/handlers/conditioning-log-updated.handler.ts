import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { firstValueFrom, Observable } from 'rxjs';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogUpdatedEvent } from '../events/conditioning-log-updated.event';
import { DomainEventHandler } from '../../shared/handlers/domain-event.handler';

/** Handler for entity updated event from ConditioningLog repository
 * @remark Updates logs in log service cache
 */
@Injectable()
export class ConditioningLogUpdateHandler extends DomainEventHandler<ConditioningLogUpdatedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) private readonly logService: ConditioningDataService, // forwardRef to avoid circular dependency
		private readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly logger: Logger
	) {
		super();
	}

	public async handle(event: ConditioningLogUpdatedEvent): Promise<void> {
		// throw error if event is not valid
		if (!(event instanceof ConditioningLogUpdatedEvent)) {
			throw new Error('Invalid event: expected ConditioningLogUpdatedEvent.');
		}		
				
		// fetch log from repo
		const logDTO = event.payload;
		const logResult = await this.logRepo.fetchById(logDTO.entityId!);
		if (logResult.isFailure) {
			this.logger.warn(`LogUpdatedHandler: Error fetching log from repo: ${logResult.error}`);
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

export default ConditioningLogUpdateHandler;