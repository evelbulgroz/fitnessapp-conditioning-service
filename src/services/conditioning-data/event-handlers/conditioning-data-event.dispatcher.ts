// event-dispatcher.ts
import { Injectable } from '@nestjs/common';

import { DomainEvent, DomainEventDTO } from '@evelbulgroz/ddd-base';

import { UserUpdatedHandler } from './user-updated.handler';
import { LogUpdatedHandler } from './log-updated.handler';
import { UserUpdatedEvent } from '../../../events/user-updated.event';
//import { LogUpdatedEvent } from '../../../events/log-updated.event';

// placeholder for LogUpdatedEvent
class LogUpdatedEvent {
	constructor(dto: any) {}
}

@Injectable()
export class ConditioningDataEventDispatcher { // or EventDispatcher if system-wide
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
		// Add more cases for other event types
		default:
			console.warn(`Unhandled event: ${event.constructor.name}`);
			break;
		}
	}
}

export default ConditioningDataEventDispatcher;