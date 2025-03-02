import { ConditioningLogUndeletedEvent } from '../events/conditioning-log-undeleted.event';
import { ConditioningLogUndeletedEventDTO } from './conditioning-log-undeleted.event.dto';

describe('ConditioningLogUndeletedEvent', () => {
	it('can be created', () => {
		expect(new ConditioningLogUndeletedEvent({
			eventId: '123',
			eventName: ConditioningLogUndeletedEvent.name,
			occurredOn: (new Date()).toISOString(),
			payload: { entityId: '123' }
		} as ConditioningLogUndeletedEventDTO)).toBeDefined();
	});
});