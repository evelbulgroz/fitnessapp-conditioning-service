import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';
import { Logger } from '@nestjs/common';

//import { jest } from '@jest/globals';

import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserUpdatedHandler } from './user-updated.handler';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';

describe('UserCreatedHandler', () => {
	let handler: UserUpdatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			providers: [
				{
					provide: ConditioningLogRepo,
					useValue: {
						create: jest.fn(),
						// add other methods as needed
					}
				},
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

		handler = module.get<UserUpdatedHandler>(UserUpdatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: UserUpdatedEvent;
		beforeEach(() => {
			event = new UserUpdatedEvent({
				eventId: '1',
				eventName: 'UserUpdatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as UserDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});