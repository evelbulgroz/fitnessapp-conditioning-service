import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

//import { jest } from '@jest/globals';

import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogLogCreatedEvent } from '../events/conditioning-log-created.event';
import { ConditioningLogCreatedHandler } from './conditioning-log-created.handler';

describe('ConditioningLogCreatedHandler', () => {
	let handler: ConditioningLogCreatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			providers: [
				{
					provide: ConditioningLogRepository,
					useValue: {
						create: jest.fn(),
						// add other methods as needed
					}
				},
				ConditioningLogCreatedHandler,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},
			],
		});

		handler = module.get<ConditioningLogCreatedHandler>(ConditioningLogCreatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: ConditioningLogLogCreatedEvent;
		beforeEach(() => {
			event = new ConditioningLogLogCreatedEvent({
				eventId: '1',
				eventName: ConditioningLogLogCreatedEvent.name,
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});