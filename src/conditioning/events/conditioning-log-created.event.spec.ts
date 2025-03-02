import { ConditioningLogCreatedEvent } from '../../events/conditioning-log-created.event';
import { ConditioningLogCreatedEventDTO } from './conditioning-log-created.event.dto';

describe('ConditioningLogCreatedEvent', () => {
	it('can be created', () => {
		expect(new ConditioningLogCreatedEvent({
			eventId: '123',
			eventName: ConditioningLogCreatedEvent.name,
			occurredOn: (new Date()).toISOString(),
			payload: {
				entityId: '123',
				activity: 'RUN',
				start: (new Date()).toISOString(),
				end: (new Date()).toISOString(),
				className: 'ConditioningLog',
			}
		} as ConditioningLogCreatedEventDTO)).toBeDefined();
	});
});