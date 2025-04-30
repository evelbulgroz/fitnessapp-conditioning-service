import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../../test/test-utils';
//import { jest } from '@jest/globals';

//import { ConsoleLogger, Logger } from '@evelbulgroz/logger';

import { ConditioningDataService } from '../../conditioning/services/conditioning-data/conditioning-data.service';
import { ConditioningLogRepository } from '../../conditioning/repositories/conditioning-log.repo';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserUpdatedHandler } from '../../user/handlers/user-updated.handler';
import { UserDTO } from '../dtos/user.dto';
import { UserRepository } from '../repositories/user.repo';

describe('UserUpdatedHandler', () => {
	let handler: UserUpdatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
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
						// add methods as needed
					}
				},
				{
					provide: UserRepository,
					useValue: {
						// add methods as needed
					}
				},
				UserUpdatedHandler, // bug: enabling this breaks the test if UserUpdatedHandler injects ConditioningDataService
			],
		}))
		.compile();

		handler = module.get<UserUpdatedHandler>(UserUpdatedHandler);
	});

	it('can be created', () => {		
		expect(handler).toBeDefined();
	});

	xdescribe('handle', () => {
		let event: UserUpdatedEvent;
		beforeEach(() => {
			event = new UserUpdatedEvent({
				eventId: '1',
				eventName: 'UserUpdatedEvent',
				occurredOn: (new Date()).toISOString(),
				payload: { entityId: '1' } as UserDTO
			});
		});

		it('needs testing!', async () => {
			await expect(handler.handle(event)).resolves.toBeUndefined();
		});
	});
});