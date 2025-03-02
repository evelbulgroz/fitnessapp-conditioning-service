import {UserCreatedEvent } from './user-created.event';
import { UserCreatedEventDTO } from './user-created.event.dto';

describe('UserCreatedEvent', () => {
	it('can be created', () => {
		expect(new UserCreatedEvent({
			eventId: '123',
			eventName: 'UserCreatedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: {
				userId: '123',
				logs: [],
				className: 'User',
			}
		} as UserCreatedEventDTO)).toBeDefined();
	});
});