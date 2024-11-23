// event-dispatcher.ts
import { Injectable } from '@nestjs/common';
import { UserUpdatedHandler } from './handlers/user-updated.handler';
import { LogUpdatedHandler } from './handlers/log-updated.handler';
import { UserUpdatedEvent } from './events/user-updated.event';
import { LogUpdatedEvent } from './events/log-updated.event';

@Injectable()
export class ConditioningDataEventDispatcher { // or EventDispatcher if system-wide
constructor(
	private readonly userUpdatedHandler: UserUpdatedHandler,
	private readonly logUpdatedHandler: LogUpdatedHandler
) {}

async dispatch(event: any): Promise<void> {
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