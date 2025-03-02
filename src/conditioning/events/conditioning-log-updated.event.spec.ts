import { ConditioningLogUpdatedEvent } from '../events/conditioning-log-updated.event';
import { ConditioningLogUpdatedEventDTO } from './conditioning-log-updated.event.dto';

describe('ConditioningLogUpdatedEvent', () => {
	it('can be created', () => {
		expect(new ConditioningLogUpdatedEvent({
			eventId: '123',
			eventName: ConditioningLogUpdatedEvent.name,
			occurredOn: (new Date()).toISOString(),
			payload: {
				entityId: '123',
				activity: 'RUN',
				start: (new Date()).toISOString(),
				end: (new Date()).toISOString(),
				className: 'ConditioningLog',
			}
		} as ConditioningLogUpdatedEventDTO)).toBeDefined();
	});
});