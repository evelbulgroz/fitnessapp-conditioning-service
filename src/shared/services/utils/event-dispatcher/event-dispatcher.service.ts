import { Global, forwardRef, Inject, Injectable } from '@nestjs/common';

import { DomainEvent, DomainEventDTO } from '@evelbulgroz/ddd-base';

import { ConditioningLogCreatedEvent } from '../../../../conditioning/events/conditioning-log-created.event';
import { ConditioningLogCreatedHandler } from '../../../../conditioning/handlers/conditioning-log-created.handler';
import { ConditioningLogDeletedEvent } from '../../../../conditioning/events/conditioning-log-deleted.event';
import { ConditioningLogDeletedHandler } from '../../../../conditioning/handlers/conditioning-log-deleted.handler';
import { ConditioningLogUndeletedEvent } from '../../../../conditioning/events/conditioning-log-undeleted.event';
import { ConditioningLogUndeletedHandler } from '../../../../conditioning/handlers/conditioning-log-undeleted.handler';
import { ConditioningLogUpdatedEvent } from '../../../../conditioning/events/conditioning-log-updated.event';
import { ConditioningLogUpdateHandler } from '../../../../conditioning/handlers/conditioning-log-updated.handler';
import { UserCreatedEvent } from '../../../../user/events/user-created.event';
import { UserCreatedHandler } from '../../../../user/handlers/user-created.handler';
import { UserDeletedEvent } from '../../../../user/events/user-deleted.event';
import { UserDeletedHandler } from '../../../../user/handlers/user-deleted.handler';
import { UserUpdatedEvent } from '../../../../user/events/user-updated.event';
import { UserUpdatedHandler } from '../../../../user/handlers/user-updated.handler';



/** Domain event dispatcher service
 * @remark Dispatches domain events to their respective handlers based on their type
 * @remark Inject into services that receive and need to handle domain events
 * @remark At the moment, the main need is to update data service cache with repo CRUD events, so single dispatcher is sufficient
 */
@Global()
@Injectable()
export class EventDispatcherService {
constructor(
	private readonly logCreatedHandler: ConditioningLogCreatedHandler,
	private readonly logUpdatedHandler: ConditioningLogUpdateHandler,
	private readonly logDeletedHandler: ConditioningLogDeletedHandler,
	@Inject(forwardRef(() => ConditioningLogUndeletedHandler)) // forwardRef to handle circular dependency
	private readonly logUndeletedHandler: ConditioningLogUndeletedHandler,
	private readonly userCreatedHandler: UserCreatedHandler,	
	private readonly userUpdatedHandler: UserUpdatedHandler,
	private readonly userDeletedHandler: UserDeletedHandler,
) {}

public async dispatch(event: DomainEvent<DomainEventDTO<any>, any>): Promise<void> {
	// Dispatch event to appropriate handler
	switch (event.constructor) {
		case ConditioningLogCreatedEvent:
			await this.logCreatedHandler.handle(event);
			break;
		case ConditioningLogUpdatedEvent:
			await this.logUpdatedHandler.handle(event);
			break;
		case ConditioningLogDeletedEvent:
			await this.logDeletedHandler.handle(event);
			break;
		case ConditioningLogUndeletedEvent:
			await this.logUndeletedHandler.handle(event);
			break;
		case UserCreatedEvent:
			await this.userCreatedHandler.handle(event);
			break;
		case UserUpdatedEvent:
			await this.userUpdatedHandler.handle(event);
			break;
		case UserDeletedEvent:
			await this.userDeletedHandler.handle(event);
			break;
		// Add more cases for other event types as they are implemented
		default:
			console.warn(`Unhandled event: ${event.constructor.name}`);
			break;
		}
	}
}

export default EventDispatcherService;