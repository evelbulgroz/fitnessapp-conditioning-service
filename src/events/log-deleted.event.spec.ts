import { LogDeletedEvent } from './log-deleted.event';
import { LogDeletedEventDTO } from './log-deleted.event.dto';

describe('LogDeletedEvent', () => {
	it('can be created', () => {
		expect(new LogDeletedEvent({
			eventId: '123',
			eventName: 'LogDeletedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: { entityId: '123' }
		} as LogDeletedEventDTO)).toBeDefined();
	});
});