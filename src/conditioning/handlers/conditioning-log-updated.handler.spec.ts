import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { Subject } from 'rxjs';

import { StreamLogger } from '../../libraries/stream-loggable';

import ConditioningDataService from '../services/conditioning-data/conditioning-data.service';
import ConditioningLogRepository from '../repositories/conditioning-log.repo';
import ConditioningLogDTO from '../dtos/conditioning-log.dto';
import ConditioningLogUpdatedEvent from '../events/conditioning-log-updated.event';
import ConditioningLogUpdatedHandler from '../handlers/conditioning-log-updated.handler';

describe('ConditioningLogUpdatedHandler', () => {
	let handler: ConditioningLogUpdatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				// ConfigModule is imported automatically by createTestingModule
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
				ConditioningLogUpdatedHandler,							
			],
		}))
		.compile();

		handler = module.get<ConditioningLogUpdatedHandler>(ConditioningLogUpdatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	xdescribe('handle', () => {
		let event: ConditioningLogUpdatedEvent;
		beforeEach(() => {
			event = new ConditioningLogUpdatedEvent({
				eventId: '1',
				eventName: ConditioningLogUpdatedEvent.name,
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
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