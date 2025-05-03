import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { Subject } from 'rxjs';

import { StreamLogger } from '../../libraries/stream-loggable';

import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogCreatedEvent } from '../events/conditioning-log-created.event';
import { ConditioningLogCreatedHandler } from '../handlers/conditioning-log-created.handler';

describe('ConditioningLogCreatedHandler', () => {
	let handler: ConditioningLogCreatedHandler;
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
				ConditioningLogCreatedHandler,				
			],
		}))
		.compile();

		handler = module.get<ConditioningLogCreatedHandler>(ConditioningLogCreatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: ConditioningLogCreatedEvent;
		beforeEach(() => {
			event = new ConditioningLogCreatedEvent({
				eventId: '1',
				eventName: ConditioningLogCreatedEvent.name,
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