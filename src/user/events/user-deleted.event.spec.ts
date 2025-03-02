import { UserDeletedEvent } from './user-deleted.event';
import { UserDeletedEventDTO } from './user-deleted.event.dto';

describe('UserDeletedEvent', () => {
	it('can be created', () => {
		expect(new UserDeletedEvent({
			eventId: '123',
			eventName: 'UserDeletedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: {
				userId: '123',
				logs: [],
				className: 'User',
			}
		} as UserDeletedEventDTO)).toBeDefined();
	});
});