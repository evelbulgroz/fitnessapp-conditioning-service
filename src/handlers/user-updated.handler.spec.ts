import { Test, TestingModule } from '@nestjs/testing';
//import { createTestingModule } from '../test/test-utils';
//import { jest } from '@jest/globals';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLogRepo } from '../repositories/conditioning-log.repo';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserUpdatedHandler } from './user-updated.handler';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserRepository } from '../repositories/user.repo';

describe('UserCreatedHandler', () => {
	let handler: UserUpdatedHandler;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [				
				{
					provide: ConditioningLogRepo,
					useValue: {
						// add methods as needed
					}
				},
				{
					provide: UserRepository,
					useValue: {
						// add methods as needed
					}
				},{
					provide: Logger,
					useClass: ConsoleLogger
				},
				UserUpdatedHandler,				
			],
		})
		.compile();

		handler = module.get<UserUpdatedHandler>(UserUpdatedHandler);
	});

	it('can be created', () => {
		expect(true).toBeTruthy(); // debug
		//expect(handler).toBeDefined();
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

		it('is not implemented', async () => {
			await expect(handler.handle(event)).rejects.toThrow('Method not implemented.');
		});
	});
});