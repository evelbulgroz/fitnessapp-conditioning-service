import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { Subject } from 'rxjs';

import { StreamLogger } from '../../libraries/stream-loggable';

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

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(handler.log$).toBeDefined();
				expect(handler.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(handler.logger).toBeDefined();
				expect(handler.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(handler.logToStream).toBeDefined();
				expect(typeof handler.logToStream).toBe('function');
			});
		});
	});
});