import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';
import { Logger } from '@nestjs/common';

//import { jest } from '@jest/globals';

import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { LogCreatedEvent } from '../events/log-created.event';
import { LogCreatedHandler } from './log-created.handler';

describe('LogCreatedHandler', () => {
	let handler: LogCreatedHandler;
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
				LogCreatedHandler,
				Logger,
			],
		});

		handler = module.get<LogCreatedHandler>(LogCreatedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: LogCreatedEvent;
		beforeEach(() => {
			event = new LogCreatedEvent({
				eventId: '1',
				eventName: 'LogCreatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});