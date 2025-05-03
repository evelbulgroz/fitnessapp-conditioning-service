import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { Subject } from 'rxjs';

import { StreamLogger } from '../../libraries/stream-loggable';

import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { ConditioningLogDeletedEvent } from '../events/conditioning-log-deleted.event';
import { ConditioningLogDeletedHandler } from '../handlers/conditioning-log-deleted.handler';

describe('LogDeletedHandler', () => {
	let handler: ConditioningLogDeletedHandler;
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
				ConditioningLogDeletedHandler,								
			],
		}))
		.compile();

		handler = module.get<ConditioningLogDeletedHandler>(ConditioningLogDeletedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: ConditioningLogDeletedEvent;
		beforeEach(() => {
			event = new ConditioningLogDeletedEvent({
				eventId: '1',
				eventName: ConditioningLogDeletedEvent.name,
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
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