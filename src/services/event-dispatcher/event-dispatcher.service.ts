// event-dispatcher.ts
import { Injectable } from '@nestjs/common';

import { DomainEvent, DomainEventDTO } from '@evelbulgroz/ddd-base';

import { UserUpdatedEvent } from '../../events/user-updated.event';


import { LogUpdatedHandler } from '../../handlers/log-updated.handler';
import { UserUpdatedHandler } from '../../handlers/user-updated.handler';


//import { LogUpdatedEvent } from '../../../events/log-updated.event';

// placeholder for LogUpdatedEvent
class LogUpdatedEvent {
	constructor(dto: any) {}
}


/** Domain event dispatcher service
 * @remark Dispatches domain events to their respective handlers based on their type
 * @remark Inject into services that receive and need to handle domain events
 */
@Injectable()
export class EventDispatcher {
constructor(
	private readonly userUpdatedHandler: UserUpdatedHandler,
	private readonly logUpdatedHandler: LogUpdatedHandler
) {}

public async dispatch(event: DomainEvent<DomainEventDTO<any>, any>): Promise<void> {
	switch (event.constructor) {
		case UserUpdatedEvent:
			await this.userUpdatedHandler.handle(event);
			break;
		case LogUpdatedEvent:
			await this.logUpdatedHandler.handle(event);
			break;
		// Add more cases for other event types as they are implemented
		default:
			console.warn(`Unhandled event: ${event.constructor.name}`);
			break;
		}
	}
}

export default EventDispatcher;