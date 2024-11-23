import { Injectable } from '@nestjs/common';

import { ConditioningDataService } from '../conditioning-data/conditioning-data.service'
import { DomainEvent, DomainEventDTO } from '@evelbulgroz/ddd-base';
import { LogCreatedEvent } from '../../events/log-created.event';
import { LogCreatedHandler } from '../../handlers/log-created.handler';
import { LogDeletedEvent } from '../../events/log-deleted.event';
import { LogDeletedHandler } from '../../handlers/log-deleted.handler';
import { LogUpdatedEvent } from '../../events/log-updated.event';
import { LogUpdatedHandler } from '../../handlers/log-updated.handler';
import { UserCreatedEvent } from '../../events/user-created.event';
import { UserCreatedHandler } from '../../handlers/user-created.handler';
import { UserDeletedEvent } from '../../events/user-deleted.event';
import { UserDeletedHandler } from '../../handlers/user-deleted.handler';
import { UserUpdatedEvent } from '../../events/user-updated.event';
import { UserUpdatedHandler } from '../../handlers/user-updated.handler';;


/** Domain event dispatcher service
 * @remark Dispatches domain events to their respective handlers based on their type
 * @remark Inject into services that receive and need to handle domain events
 * @remark At the moment, the main need is to update data service cache with repo CRUD events, so single dispatcher is sufficient
 */
@Injectable()
export class EventDispatcher {
constructor(
	private readonly logCreatedHandler: LogCreatedHandler,
	private readonly logUpdatedHandler: LogUpdatedHandler,
	private readonly logDeletedHandler: LogDeletedHandler,
	private readonly userCreatedHandler: UserCreatedHandler,	
	private readonly userUpdatedHandler: UserUpdatedHandler,
	private readonly userDeletedHandler: UserDeletedHandler,
) {}

public async dispatch(event: DomainEvent<DomainEventDTO<any>, any>): Promise<void> {
	switch (event.constructor) {
		case LogCreatedEvent:
			await this.logCreatedHandler.handle(event);
			break;
		case LogUpdatedEvent:
			await this.logUpdatedHandler.handle(event);
			break;
		case LogDeletedEvent:
			await this.logDeletedHandler.handle(event);
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

export default EventDispatcher;