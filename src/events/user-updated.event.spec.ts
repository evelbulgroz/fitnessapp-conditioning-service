import { UserUpdatedEvent } from './user-updated.event';
import { UserUpdatedEventDTO } from './user-updated.event.dto';

describe('UserUpdatedEvent', () => {
	it('can be created', () => {
		expect(new UserUpdatedEvent({
			eventId: '123',
			eventName: 'UserUpdatedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: {
				userId: '123',
				logs: [],
				className: 'User',
			}
		} as UserUpdatedEventDTO)).toBeDefined();
	});
});