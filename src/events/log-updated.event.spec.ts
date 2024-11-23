import { LogUpdatedEvent } from './log-updated.event';
import { LogUpdatedEventDTO } from './log-updated.event.dto';

describe('LogUpdatedEvent', () => {
	it('can be created', () => {
		expect(new LogUpdatedEvent({
			eventId: '123',
			eventName: 'LogUpdatedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: {
				entityId: '123',
				activity: 'RUN',
				start: (new Date()).toISOString(),
				end: (new Date()).toISOString(),
				className: 'ConditioningLog',
			}
		} as LogUpdatedEventDTO)).toBeDefined();
	});
});