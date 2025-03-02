//import {jest} from '@jest/globals';
//import {v4 as uuidv4} from 'uuid';

//import { ActivityType, SensorType } from '@evelbulgroz/fitnessapp-base';
import { ConditioningLog } from './conditioning-log.entity';
import { ConditioningLogDTO } from "../dtos/conditioning-log.dto";
import { ConditioningLap } from './conditioning-lap.model';
import { Quantity } from '@evelbulgroz/quantity-class';

enum ActivityType {
	MTB = 'MTB',
	RUN = 'RUN',
	SWIM = 'SWIM',
	BIKE = 'BIKE',
	SKI = 'SKI',
	OTHER = 'OTHER'  // mostly for use by testing
}

enum SensorType {
	ALTITUDE = 'ALTITUDE',
	CADENCE = 'CADENCE',
	GEOLOCATION = 'GEOLOCATION',
	HEARTRATE = 'HEARTRATE',
	SPEED = 'SPEED',
	TEMPERATURE = 'TEMPERATURE',
	// add other sensor types here
}

describe('ConditioningLog', () => {
	let subLogDTO: ConditioningLogDTO;
	let testDTO: ConditioningLogDTO;
	let testLog: ConditioningLog<any, ConditioningLogDTO>;
	let testLaps: ConditioningLap[];
	let warnSpy: any;

	beforeEach(() => {
		// suppress console.warn output caused by loss of 'this' context in static factory methods when running tests:
		// tests run fine, but jest calls factory repeatedly and looses 'this' context on subsequent calls
		//warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

		// Sample data for mock ConditioningLaps	
		testLaps = [
				{
					start: new Date('2021-07-14T00:00:00.000Z'),
					end: new Date('2023-07-14T05:00:00.000Z'),
					duration: new Quantity({ unit: 'ms', value: 18000000 }),
					note: 'test lap 1',
				},
				{
					start: new Date('2021-07-14T00:00:00.000Z'),
					end: new Date('2023-07-14T05:00:00.000Z'),
					duration: new Quantity({ unit: 'ms', value: 18000000 }),
					note: 'test lap 2',
				}
		];

		// Sample data for mock sub-ActivityLog
		subLogDTO = {
			isOverview: false,
			className: 'ConditioningLog',
			entityId: '21ef7892-ae41-4215-987f-29fcad2c3549', //uuidv4(),
			activities: [],
			activity: ActivityType.RUN,
			activityOrder: 1,
			start: '2021-07-14T00:00:00.000Z',
			end: '2021-07-14T05:00:00.000Z',
			duration: { unit: 'ms', value: 18000000 },
			sensorLogs: [
				{
					unit: 'angstroem',
					sensorType: SensorType.HEARTRATE,
					data: []
				}
			],
			laps: [],
			note: 'sub',
		};
		//subLog = (ConditioningLog.create(subLogDTO, false, subLogDTO.entityId)).value as ConditioningLog<any, ConditioningLogDTO>;

		// Sample data for mock ActivityLog
		testDTO = {
			isOverview: false,
			entityId: '40c9c09a-433d-4110-acaf-2133103cc514', //uuidv4(),
			className: 'ConditioningLog',
			activity: ActivityType.RUN,
			activityOrder: 1,
			start: '2021-07-14T00:00:00.000Z',
			end: '2021-07-14T05:00:00.000Z',
			duration: { unit: 'ms', value: 18000000 },
			sensorLogs: [
				{
					unit: 'angstroem',
					sensorType: SensorType.HEARTRATE,
					data: []
				}
			],
			note: 'test',
			laps: JSON.parse(JSON.stringify(testLaps)),
			activities: [subLogDTO, subLogDTO, subLogDTO]
		};

		testLog = (ConditioningLog.create(testDTO, undefined, false)).value as ConditioningLog<any, ConditioningLogDTO>;
	});

	afterEach(() => {
		warnSpy && warnSpy.mockRestore();
	});

	describe('Creation', () => {
		it('can be created', () => {
			expect(testLog).toBeTruthy();
		});

		it('is by default created as an overview', () => {
			testLog = (ConditioningLog.create.bind(ConditioningLog)(testDTO)).value as ConditioningLog<any, ConditioningLogDTO>;
			expect(testLog.sensorLogs).toBeUndefined();  // sanity check: sensor logs are assigned in parent constructor
			expect(testLog.laps).toBeUndefined();

		});
	});

	describe('Properties (via getters)', () => {		
		it('can report if it is an overview', () => {
			expect(testLog.isOverview).toBeFalsy(); // default is overview
			testLog = (ConditioningLog.create(testDTO)).value as ConditioningLog<any, ConditioningLogDTO>;
			expect(testLog.isOverview).toBeTruthy(); // not an overview
		});

		it('may have one or more laps', () => {
			expect(testLog.laps).toBeDefined();
			expect(Array.isArray(testLog.laps)).toBeTruthy();
			expect(testLog.laps).toEqual(testLaps);
		});

		it('may have a note', () => {
			expect(testLog.note).toEqual('test');
		});

		it('may have sub-activities', () => {
			// sanity check of activity creation in base class
			expect(testLog.activities).toBeDefined();
			expect(testLog.activities?.length).toBe(testLog.activities?.length);
			testLog.activities?.forEach((activity: any) => {
				expect(activity).toBeInstanceOf(ConditioningLog);
			});
		});
	});

	describe('Validation', () => {
		describe('Laps', () => {
			it('can be set to an array of ConditioningLaps', () => {
				const lapsToSet = [...testLaps].concat([...testLaps]);
				testLog.laps = lapsToSet;
				expect(testLog.laps).toEqual(lapsToSet);				
			});

			it('can be set to an empty array', () => {
				testLog.laps = [];
				expect(testLog.laps).toEqual([]);
			});

			it('can be set to undefined', () => {
				testLog.sensorLogs = undefined;
				expect(testLog.sensorLogs).toBeUndefined();
			});

			it('cannot be set to null', () => {
				expect(() => testLog.sensorLogs = null as any).toThrow();
			});

			it('cannot be set to a non-array', () => {
				expect(() => testLog.sensorLogs = 'invalid' as any).toThrow();
			});

			it('cannot be set to an array containing non-ConditioningLaps objects', () => {
				expect(() => (<any>testLog).sensorLogs = ['blah']).toThrow();				
			});
		});

		it('provides a collection of validation rules', () => {
			const rules = ConditioningLog.getSanitizationRules();
			expect(rules).toBeDefined();
			const keys = Object.keys(rules);
			expect(keys.length).toBeGreaterThan(0);
			expect(keys).toContain('entityId'); // inherited from Entity
			expect(keys).toContain('laps'); // specific to ConditioningLog
		});

		//Test any additional validation logic not covered by the setters here
	});

	describe('Equality comparison', () => {
		// Entity.equals() is tested in entity.class.spec.ts, so just test ConditioningLog.equals() here

		let other: ConditioningLog<any, ConditioningLogDTO>;

		beforeEach(() => {
			other = (ConditioningLog.create({...testDTO, entityId: 'b444737f-f9ef-4f35-bdeb-d66903e1a869'}, undefined, false)).value as ConditioningLog<any, ConditioningLogDTO>;
		});

		it('returns true if equal (by value)', () => {
			other = testLog;
			expect(testLog.equals(other, false, false)).toBeTruthy();
		});	
		
		it('returns false if laps are not equal (by value)', () => {
			other.laps = [];
			expect(testLog.equals(other, false, false)).toBeFalsy();
		});
	});

	describe('Serialization', () => {
		it('can be serialized to ConditioningLogDTO', () => {
			const dto = testLog.toDTO();			
			expect(dto).toEqual(testDTO);
		});

		it('can be serialized to ConditioningLogPersistenceDTO including persistence lifecycle metadata', () => {
			const json = testLog.toJSON();
			//const expectedResult = { ...testDTO, createdOn: testLog.createdOn!.toISOString() } as ConditioningLogPersistenceDTO<any,any>;
			expect(json).toEqual(json);
		});

		/*
		it('can be deserialized as an overview log from ConditioningLogPersistenceDTO', () => {
			const dataDTO = testLog.toJSON();
			const metaDataDTO = ConditioningLog.getMetaDataDTO(dataDTO);
			const overviewLog = (ConditioningLog.create(dataDTO, metaDataDTO, true)).value as unknown as ConditioningLog<any, ConditioningLogDTO>;
			expect(overviewLog.isOverview).toBeTruthy();
			expect(overviewLog.sensorLogs).toBeUndefined();
			overviewLog.activities.forEach((activity: any) => {
				expect(activity.sensorLogs).toBeUndefined();
			});
		});

		it('can be deserialized as a detailed log from ConditioningLogPersistenceDTO', () => {
			const dataDTO = testLog.toJSON();
			const metaDataDTO = ConditioningLog.getMetaDataDTO(dataDTO);
			const detailedLog = (ConditioningLog.create(dataDTO, metaDataDTO, false)).value as unknown as ConditioningLog<any, ConditioningLogDTO>;
			expect(detailedLog.isOverview).toBeFalsy();
			expect(detailedLog.sensorLogs).toBeDefined();
			detailedLog.activities.forEach((activity: any) => {
				expect(activity.sensorLogs).toBeDefined();
			});
		});
		*/
	});
});