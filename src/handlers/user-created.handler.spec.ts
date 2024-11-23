import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

//import { jest } from '@jest/globals';

import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserCreatedHandler } from './user-created.handler';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';

describe('UserCreatedHandler', () => {
	let handler: UserCreatedHandler;
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
				UserCreatedHandler,
				{
					provide: UserRepository,
					useValue: {
						create: jest.fn(),
						// add other methods as needed
					}
				},
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
			],
		});

		handler = module.get<UserCreatedHandler>(UserCreatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: UserCreatedEvent;
		beforeEach(() => {
			event = new UserCreatedEvent({
				eventId: '1',
				eventName: 'UserCreatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as UserDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});