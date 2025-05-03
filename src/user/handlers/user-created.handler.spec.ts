import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { Subject } from 'rxjs';

import { StreamLogger } from '../../libraries/stream-loggable';

import ConditioningDataService from '../../conditioning/services/conditioning-data/conditioning-data.service';
import ConditioningLogRepository from '../../conditioning/repositories/conditioning-log.repo';
import UserCreatedEvent from '../events/user-created.event';
import UserCreatedHandler from '../handlers/user-created.handler';
import UserDTO from '../dtos/user.dto';
import UserRepository from '../repositories/user.repo';

describe('UserCreatedHandler', () => {
	let handler: UserCreatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			providers: [
				{
					provide: ConditioningDataService,
					useValue: {
						// add methods as needed
					},
				},
				{
					provide: ConditioningLogRepository,
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
			],
		}))
		.compile();

		handler = module.get<UserCreatedHandler>(UserCreatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	xdescribe('handle', () => {
		let event: UserCreatedEvent;
		beforeEach(() => {
			event = new UserCreatedEvent({
				eventId: '1',
				eventName: 'UserCreatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as UserDTO
			});
		});

		it('needs testing!', async () => {
			await expect(handler.handle(event)).resolves.toBeUndefined();
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