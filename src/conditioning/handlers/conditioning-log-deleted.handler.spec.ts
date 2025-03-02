import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

//import { jest } from '@jest/globals';

import { ConditioningLogRepository } from '../repositories/conditioning-log.repo';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogDeletedEvent } from '../events/conditioning-log-deleted.event';
import { ConditioningLogDeletedHandler } from '../../shared/handlers/conditioning-log-deleted.handler';

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
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
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
});