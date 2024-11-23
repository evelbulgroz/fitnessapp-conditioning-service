import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';
import { Logger } from '@nestjs/common';

//import { jest } from '@jest/globals';

import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { LogUpdatedEvent } from '../events/log-updated.event';
import { LogUpdatedHandler } from './log-updated.handler';

describe('LogUpdatedHandler', () => {
	let handler: LogUpdatedHandler;
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
				LogUpdatedHandler,
				Logger,
			],
		});

		handler = module.get<LogUpdatedHandler>(LogUpdatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: LogUpdatedEvent;
		beforeEach(() => {
			event = new LogUpdatedEvent({
				eventId: '1',
				eventName: 'LogUpdatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});