import { TestingModule } from '@nestjs/testing';
import { createTestingModule } from '../test/test-utils';

import { v4 as uuidv4 } from 'uuid';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

//import { jest } from '@jest/globals';

import { ConditioningDataService, UserLogsCacheEntry} from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { ConditioningLogUndeletedEvent } from '../events/conditioning-log-undeleted.event';
import { ConditioningLogUndeletedHandler } from './conditioning-log-undeleted.handler';
import { User } from '../domain/user.entity';
import { UserDTO } from '../dtos/domain/user.dto';
import { after } from 'node:test';
import { random } from 'lodash-es';


describe('LogUndeletedHandler', () => {
	let handler: ConditioningLogUndeletedHandler;
	let service: ConditioningDataService;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			providers: [
				{
					provide: ConditioningDataService,
					useValue: {
						getCacheSnapshot: jest.fn(),
						updateCache: jest.fn(),
						// add other methods as needed
					}
				},
				ConditioningLogUndeletedHandler,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},				
			],
		});

		handler = module.get<ConditioningLogUndeletedHandler>(ConditioningLogUndeletedHandler);
		service = module.get<ConditioningDataService>(ConditioningDataService);
	});

	let randomLogDTO: ConditioningLogDTO;
	let randomLog: ConditioningLog<any, ConditioningLogDTO>;
	let testLogs: ConditioningLog<any, ConditioningLogDTO>[];
	let testUser: User;
	let testCache: UserLogsCacheEntry[];
	beforeEach( async () => {
		const testDTOs: ConditioningLogDTO[] = [
			{
				entityId: uuidv4(),
				activity: ActivityType.BIKE,									
				duration: {value: 80000, unit: "ms"},
				isOverview: true,
				className: 'ConditioningLog',
			},
			{
				entityId: uuidv4(),
				activity: ActivityType.RUN,									
				duration: {value: 50000, unit: "ms"},
				isOverview: true,
				className: 'ConditioningLog',
			},
			{
				entityId: uuidv4(),
				activity: ActivityType.SWIM,									
				duration: {value: 3000, unit: "ms"},
				isOverview: true,
				className: 'ConditioningLog',
			},
		];
		testLogs = testDTOs.map(dto => ConditioningLog.create(dto).value as ConditioningLog<any, ConditioningLogDTO>);

		testUser = User.create(<UserDTO>{
			entityId: uuidv4(),
			userId: uuidv4(), // id in user microservice, usually a uuid
			logs: testLogs.map(log => log.entityId),
		}).value as unknown as User;

		testCache = [
			{
				userId: testUser.userId,
				logs: testLogs,
			}
		];

		const randomIndex = Math.floor(Math.random() * testLogs.length);
		randomLogDTO = testLogs[randomIndex].toDTO();
		randomLog = testLogs[randomIndex];
	});

	let getCacheSnapshotSpy: jest.SpyInstance;
	let updateCacheSpy: jest.SpyInstance;
	beforeEach(() => {
		jest.clearAllMocks();
		getCacheSnapshotSpy = jest.spyOn(service, 'getCacheSnapshot').mockReturnValue(testCache);
		updateCacheSpy = jest.spyOn(service, 'updateCache');
	});

	afterEach(() => {
		getCacheSnapshotSpy?.mockRestore();
		updateCacheSpy?.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(handler).toBeDefined();
	});

	describe('handle', () => {
		let event: ConditioningLogUndeletedEvent;
		beforeEach(() => {
			event = new ConditioningLogUndeletedEvent({
				eventId: uuidv4(),
				eventName: ConditioningLogUndeletedEvent.name,
				occurredOn: (new Date()).toISOString(),
				payload: randomLogDTO
			});
		});

		it('marks log as undeleted in data service cache', async () => {
			// arrange
			expect(randomLog.deletedOn).toBeUndefined(); // sanity check
			randomLog.deletedOn = new Date();
			
			// act
			await handler.handle(event);

			// assert
			expect(getCacheSnapshotSpy).toHaveBeenCalled();
			expect(updateCacheSpy).toHaveBeenCalled();
			expect(updateCacheSpy.mock.calls[0][0]).toEqual(testCache);
			
			const updatedCache = updateCacheSpy.mock.calls[0][0];
			const updatedLogs = updatedCache.flatMap((entry: UserLogsCacheEntry) => entry.logs);
			const updatedLog = updatedLogs.find((log: ConditioningLog<any, ConditioningLogDTO>) => log.entityId === randomLogDTO.entityId);
			expect(updatedLog?.deletedOn).toBeUndefined();
		});
	});
});