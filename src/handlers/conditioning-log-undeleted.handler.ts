import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLogUndeletedEvent } from '../events/conditioning-log-undeleted.event';
import { DomainEventHandler } from './domain-event.handler';

/** Handler for entity undeleted event from ConditioningLog repository
 * @remark Marks log as undeleted in data service cache
 */
@Injectable()
export class ConditioningLogUndeletedHandler extends DomainEventHandler<ConditioningLogUndeletedEvent> {
	constructor(
		@Inject(forwardRef(() => ConditioningDataService)) // forwardRef to handle circular dependency
		private readonly logService: ConditioningDataService,
		private readonly logger: Logger
	) {
		super();
	}

	/** Handle the undeleted event
	 * @param event The undeleted event to handle
	 * @returns A promise that resolves when the event has been handled
	 * @remark Marks log as undeleted in data service cache
	 * @remark Throws an error if the event is not a ConditioningLogUndeletedEvent
	 * @remark Logs a warning if the log is not found in the cache
	 */
	public async handle(event: ConditioningLogUndeletedEvent): Promise<void> {
		// throw error if event is not valid
		if (!(event instanceof ConditioningLogUndeletedEvent)) {
			throw new Error(`Invalid event: expected ConditioningLogUndeletedEvent.`);
		}
		
		// get flattend cache (no user info in event, so can't get entry by user id)
		const cache = this.logService.getCacheSnapshot(this);
		const logs = cache.flatMap(entry => entry.logs)	
		
		// get cached log (safe b/c log entity ids are unique across all users)
		const logDTO = event.payload;
		const log = logs.find(log => log.entityId === logDTO.entityId);

		// if log is not found, log a warning and return
		if (!log) {
			this.logger.warn(`Log ${logDTO.entityId} not found in cache.`);
			return;
		}

		// mark log as undeleted
		log.deletedOn = undefined;

		// update cache
		this.logService.updateCache(cache, this);

		this.logger.log(`Log ${logDTO.entityId} undeleted.`);
	}
}

export default ConditioningLogUndeletedHandler;