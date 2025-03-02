import { ConditioningLogDeletedEvent } from '../../events/conditioning-log-deleted.event';
import { ConditioningLogDeletedEventDTO } from './conditioning-log-deleted.event.dto';

describe('ConditioningLogDeletedEvent', () => {
	it('can be created', () => {
		expect(new ConditioningLogDeletedEvent({
			eventId: '123',
			eventName: ConditioningLogDeletedEvent.name,
			occurredOn: (new Date()).toISOString(),
			payload: { entityId: '123' }
		} as ConditioningLogDeletedEventDTO)).toBeDefined();
	});
});