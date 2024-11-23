import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';
import { Logger } from '@nestjs/common';

//import { jest } from '@jest/globals';

import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserDeletedHandler } from './user-deleted.handler';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';

describe('UserCreatedHandler', () => {
	let handler: UserDeletedHandler;
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
				UserDeletedHandler,
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

		handler = module.get<UserDeletedHandler>(UserDeletedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: UserDeletedEvent;
		beforeEach(() => {
			event = new UserDeletedEvent({
				eventId: '1',
				eventName: 'UserDeletedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as UserDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});