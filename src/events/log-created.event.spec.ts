import { LogCreatedEvent } from './log-created.event';
import { LogCreatedEventDTO } from './log-created.event.dto';

describe('LogCreatedEvent', () => {
	it('can be created', () => {
		expect(new LogCreatedEvent({
			eventId: '123',
			eventName: 'LogCreatedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: {
				entityId: '123',
				activity: 'RUN',
				start: (new Date()).toISOString(),
				end: (new Date()).toISOString(),
				className: 'ConditioningLog',
			}
		} as LogCreatedEventDTO)).toBeDefined();
	});
});