import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';
//import { jest } from '@jest/globals';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogUpdatedEvent } from '../events/conditioning-log-updated.event';
import { ConditioningLogUpdateHandler } from './conditioning-log-updated.handler';

describe('LogUpdatedHandler', () => {
	let handler: ConditioningLogUpdateHandler;
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
				ConditioningLogUpdateHandler,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
			],
		});

		handler = module.get<ConditioningLogUpdateHandler>(ConditioningLogUpdateHandler);
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
});