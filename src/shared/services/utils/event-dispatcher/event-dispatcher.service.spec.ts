import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../../../test/test-utils';

import { Logger, ConsoleLogger } from '@evelbulgroz/ddd-base';
//import { jest } from '@jest/globals';

import { ConditioningDataService } from '../../../../conditioning/services/conditioning-data/conditioning-data.service';
import { ConditioningLogDTO } from '../../../../conditioning/dtos/conditioning-log.dto';
import { ConditioningLogRepository } from '../../../../conditioning/repositories/conditioning-log.repo';
import { EventDispatcher } from '../event-dispatcher/event-dispatcher.service';
import { ConditioningLogCreatedEvent } from '../../../../conditioning/events/conditioning-log-created.event';
import { ConditioningLogCreatedHandler } from '../../../../conditioning/handlers/conditioning-log-created.handler';
import { ConditioningLogDeletedEvent } from '../../../../conditioning/events/conditioning-log-deleted.event';
import { ConditioningLogDeletedHandler } from '../../../../conditioning/handlers/conditioning-log-deleted.handler';
import { ConditioningLogUndeletedEvent } from '../../../../conditioning/events/conditioning-log-undeleted.event';
import { ConditioningLogUndeletedHandler } from '../../../../conditioning/handlers/conditioning-log-undeleted.handler';
import { ConditioningLogUpdatedEvent } from '../../../../conditioning/events/conditioning-log-updated.event';
import { ConditioningLogUpdateHandler } from '../../../../conditioning/handlers/conditioning-log-updated.handler';
import { UserCreatedEvent } from '../../../../user/events/user-created.event';
import { UserCreatedHandler } from '../../../../user/handlers/user-created.handler';
import { UserDeletedEvent } from '../../../../user/events/user-deleted.event';
import { UserDeletedHandler } from '../../../../user/handlers/user-deleted.handler';
import { UserUpdatedEvent } from '../../../../user/events/user-updated.event';
import { UserUpdatedHandler } from '../../../../user/handlers/user-updated.handler';
import { UserDTO } from '../../../../user/dtos/user.dto';
import { UserRepository } from '../../../../user/repositories/user.repo';

describe('EventDispatcher', () => {
	let dispatcher: EventDispatcher;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				{ // ConditioningDataService
					provide: ConditioningDataService,
					useValue: {
						getCacheSnapshot: jest.fn(),
						updateCache: jest.fn(),
					}
				},
				{ // ConditioningLogRepository
					provide: ConditioningLogRepository,
					useValue: {
						// add methods as needed
					}
				},
				{ // Logger
					provide: Logger,
					useClass: ConsoleLogger
				},
				EventDispatcher,
				ConditioningLogCreatedHandler,
				ConditioningLogDeletedHandler,
				ConditioningLogUpdateHandler,
				ConditioningLogUndeletedHandler,
				UserCreatedHandler,
				UserDeletedHandler,
				UserUpdatedHandler,
				{ // UserRepository
					provide: UserRepository,
					useValue: {
						create: jest.fn(),
						// add other methods as needed
					}
				}
			],
		}))
		.compile();

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
				const event = new ConditioningLogCreatedEvent({
					eventId: '1',
					eventName: ConditioningLogCreatedEvent.name,
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(ConditioningLogCreatedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
			});

			it('dispatches log updated event to log updated handler', async () => {
				// arrange
				const event = new ConditioningLogUpdatedEvent({
					eventId: '1',
					eventName: ConditioningLogUpdatedEvent.name,
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(ConditioningLogUpdateHandler.prototype, 'handle').mockImplementation(() => Promise.resolve());

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).not.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
			});

			it('dispatches log deleted event to log deleted handler', async () => {
				// arrange
				const event = new ConditioningLogDeletedEvent({
					eventId: '1',
					eventName: ConditioningLogDeletedEvent.name,
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(ConditioningLogDeletedHandler.prototype, 'handle');

				// act
				// handler method not implemented yet, so expect an error
				expect(async () => await dispatcher.dispatch(event)).rejects.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
			});

			it('dispatches log undeleted event to log undeleted handler', async () => {
				// arrange
				const event = new ConditioningLogUndeletedEvent({
					eventId: '1',
					eventName: ConditioningLogUndeletedEvent.name,
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as ConditioningLogDTO
				});

				const handleSpy = jest.spyOn(ConditioningLogUndeletedHandler.prototype, 'handle').mockImplementation(() => Promise.resolve());

				// act
				expect(async () => await dispatcher.dispatch(event)).not.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);

				// clean up
				handleSpy?.mockRestore();
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

				const handleSpy = jest.spyOn(UserCreatedHandler.prototype, 'handle').mockImplementation(() => Promise.resolve());

				// act
				expect(async () => await dispatcher.dispatch(event)).not.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
			});

			it('dispatches user updated event to user updated handler', async () => {
				// arrange
				const event = new UserUpdatedEvent({
					eventId: '1',
					eventName: 'UserUpdatedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as UserDTO
				});

				const handleSpy = jest.spyOn(UserUpdatedHandler.prototype, 'handle').mockImplementation(() => Promise.resolve());

				// act
				expect(async () => await dispatcher.dispatch(event)).not.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
			});

			it('dispatches user deleted event to user deleted handler', async () => {
				// arrange
				const event = new UserDeletedEvent({
					eventId: '1',
					eventName: 'UserDeletedEvent',
					occurredOn: (new Date()).toISOString(),
					payload: { entityId: '1' } as UserDTO
				});

				const handleSpy = jest.spyOn(UserDeletedHandler.prototype, 'handle').mockImplementation(() => Promise.resolve());

				// act
				expect(async () => await dispatcher.dispatch(event)).not.toThrow();

				// assert
				expect(handleSpy).toHaveBeenCalledTimes(1);
				expect(handleSpy).toHaveBeenCalledWith(event);
			});
		});
	});
});