import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { Logger } from '@evelbulgroz/ddd-base';
//import { jest } from '@jest/globals';

import { ConditioningDataService } from '../../services/conditioning-data/conditioning-data.service';
import { ConditioningLogDTO } from '../../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepo } from '../../repositories/conditioning-log.repo';
import { EventDispatcher } from '../../services/event-dispatcher/event-dispatcher.service';
import { LogCreatedEvent } from '../../events/log-created.event';
import { LogCreatedHandler } from '../../handlers/log-created.handler';
import { LogDeletedEvent } from '../../events/log-deleted.event';
import { LogDeletedHandler } from '../../handlers/log-deleted.handler';
import { LogUpdatedEvent } from '../../events/log-updated.event';
import { LogUpdatedHandler } from '../../handlers/log-updated.handler';
import { UserCreatedEvent } from '../../events/user-created.event';
import { UserCreatedHandler } from '../../handlers/user-created.handler';
import { UserDeletedEvent } from '../../events/user-deleted.event';
import { UserDeletedHandler } from '../../handlers/user-deleted.handler';
import { UserUpdatedEvent } from '../../events/user-updated.event';
import { UserUpdatedHandler } from '../../handlers/user-updated.handler';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user.repo';

describe('EventDispatcher', () => {
	let dispatcher: EventDispatcher;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			providers: [
				{
					provide: ConditioningDataService,
					useValue: {
						// add methods as needed
					}
				},
				{
					provide: ConditioningLogRepo,
					useValue: {
						// add methods as needed
					}
				},
				{
					provide: ConditioningLogRepo,
					useValue: {
						// add methods as needed
					}
				},
				EventDispatcher,
				LogCreatedHandler,
				LogDeletedHandler,
				LogUpdatedHandler,
				UserCreatedHandler,
				UserDeletedHandler,
				UserUpdatedHandler,
				{
					provide: UserRepository,
					useValue: {
						create: jest.fn(),
						// add other methods as needed
					}
				},
				Logger,
			],
		});

		dispatcher = module.get<EventDispatcher>(EventDispatcher);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(dispatcher).toBeDefined();
	});

	describe('dispatch', () => {
		describe('log events', () => {		
			it('dispatches log created event to log created handler', async () => {
				// arrange
				const event = new LogCreatedEvent({
					eventId: '1',
					eventName: 'LogCreatedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(LogCreatedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
				//expect(result).toBeUndefined();
			});

			it('dispatches log updated event to log updated handler', async () => {
				// arrange
				const event = new LogUpdatedEvent({
					eventId: '1',
					eventName: 'LogUpdatedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(LogUpdatedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
				//expect(result).toBeUndefined();
			});

			it('dispatches log deleted event to log deleted handler', async () => {
				// arrange
				const event = new LogDeletedEvent({
					eventId: '1',
					eventName: 'LogDeletedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(LogDeletedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
				//expect(result).toBeUndefined();
			});
		});

		describe('user events', () => {
			it('dispatches user created event to user created handler', async () => {
				// arrange
				const event = new UserCreatedEvent({
					eventId: '1',
					eventName: 'UserCreatedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as UserDTO
				});

				const handleSpy = jest.spyOn(UserCreatedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
				//expect(result).toBeUndefined();
			});

			it('dispatches user updated event to user updated handler', async () => {
				// arrange
				const event = new UserUpdatedEvent({
					eventId: '1',
					eventName: 'UserUpdatedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as UserDTO
				});

				const handleSpy = jest.spyOn(UserUpdatedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
				//expect(result).toBeUndefined();
			});

			it('dispatches user deleted event to user deleted handler', async () => {
				// arrange
				const event = new UserDeletedEvent({
					eventId: '1',
					eventName: 'UserDeletedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as UserDTO
				});

				const handleSpy = jest.spyOn(UserDeletedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
				//expect(result).toBeUndefined();
			});
		});
	});
});