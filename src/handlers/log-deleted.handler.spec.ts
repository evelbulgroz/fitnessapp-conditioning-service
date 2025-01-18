import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

//import { jest } from '@jest/globals';

import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { LogDeletedEvent } from '../events/log-deleted.event';
import { LogDeletedHandler } from './log-deleted.handler';

describe('LogDeletedHandler', () => {
	let handler: LogDeletedHandler;
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
				LogDeletedHandler,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
			],
		});

		handler = module.get<LogDeletedHandler>(LogDeletedHandler);
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: LogDeletedEvent;
		beforeEach(() => {
			event = new LogDeletedEvent({
				eventId: '1',
				eventName: 'LogDeletedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as ConditioningLogDTO
			});
		});

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});