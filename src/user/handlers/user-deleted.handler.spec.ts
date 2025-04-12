import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';
//import { jest } from '@jest/globals';

import { ConsoleLogger, Logger } from '@evelbulgroz/logger';

import { ConditioningLogRepository } from '../../conditioning/repositories/conditioning-log.repo';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserDeletedHandler } from '../handlers/user-deleted.handler';
import { UserDTO } from '../dtos/user.dto';
import { UserRepository } from '../repositories/user.repo';

describe('UserCreatedHandler', () => {
	let handler: UserDeletedHandler;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			providers: [
				{
					provide: ConditioningLogRepository,
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
				{ // Logger (suppress console output)
					provide: Logger,
					useValue: {
						log: jest.fn(),
						error: jest.fn(),
						warn: jest.fn(),
						debug: jest.fn(),
						verbose: jest.fn(),
					},
				},				
			],
		}))
		.compile();

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