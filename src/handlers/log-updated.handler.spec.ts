import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';
//import { jest } from '@jest/globals';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { LogUpdatedEvent } from '../events/log-updated.event';
import { LogUpdatedHandler } from './log-updated.handler';

describe('LogUpdatedHandler', () => {
	let handler: LogUpdatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
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
				LogUpdatedHandler,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
			],
		});

		handler = module.get<LogUpdatedHandler>(LogUpdatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	xdescribe('handle', () => {
		let event: LogUpdatedEvent;
		beforeEach(() => {
			event = new LogUpdatedEvent({
				eventId: '1',
				eventName: 'LogUpdatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
			});
		});

		it('needs testing!', async () => {
			await expect(handler.handle(event)).resolves.toBeUndefined();
		});
	});
});