import { UserUndeletedEvent } from './user-undeleted.event';
import { UserUndeletedEventDTO } from './user-undeleted.event.dto';

describe('UserUneletedEvent', () => {
	it('can be created', () => {
		expect(new UserUndeletedEvent({
			eventId: '123',
			eventName: 'UserDeletedEvent',
			occurredOn: (new Date()).toISOString(),
			payload: {
				userId: '123',
				logs: [],
				className: 'User',
			}
		} as UserUndeletedEventDTO)).toBeDefined();
	});
});