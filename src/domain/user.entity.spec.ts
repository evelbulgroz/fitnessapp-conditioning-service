import {jest} from '@jest/globals';

import {v4 as uuidv4} from 'uuid';

import { User } from './user.entity';
import { UserDTO } from '../dtos/user.dto';
import { EntityId } from '@evelbulgroz/ddd-base';

describe('User', () => {
	let testDTO: UserDTO;
	let testUser: User;
	let testLogs: EntityId[];
	let warnSpy: any;

	beforeEach(() => {
		// suppress console.warn output caused by loss of 'this' context in static factory methods when running tests:
		// tests run fine, but jest calls factory repeatedly and looses 'this' context on subsequent calls
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

		testLogs = new Array(10).fill(0).map(() => uuidv4());

		// Sample data for mock ActivityLog
		testDTO = {
			entityId: uuidv4(),
			userId: uuidv4(),
			logs: testLogs,
			className: 'User',
		};

		testUser = (User.create(testDTO, testDTO.entityId, undefined, undefined)).value as User;
	});

	afterEach(() => {
		warnSpy && warnSpy.mockRestore();
	});

	describe('Creation', () => {
		it('can be created', () => {
			expect(testUser).toBeTruthy();
		});
	});

	describe('Properties (via getters)', () => {		
		it('has a user id', () => {	
			expect(testUser.userId).toBeDefined();
			expect(testUser.userId).toEqual(testDTO.userId);
		});

		it('may have one or more logs', () => {
			expect(testUser.logs).toBeDefined();
			expect(Array.isArray(testUser.logs)).toBeTruthy();
			expect(testUser.logs).toEqual(testLogs);
		});		
	});

	describe('Validation', () => {
		describe('Logs', () => {
			it('can be set to an array of EntityIds', () => {
				const logsToSet = [...testLogs].concat([...testLogs]);
				testUser.logs = logsToSet;
				expect(testUser.logs).toEqual(logsToSet);				
			});

			it('can be set to an empty array', () => {
				testUser.logs = [];
				expect(testUser.logs).toEqual([]);
			});

			it('cannot be set to undefined', () => {
				expect(() => testUser.logs = undefined as any).toThrow();
			});

			it('cannot be set to null', () => {
				expect(() => testUser.logs = null as any).toThrow();
			});

			it('cannot be set to a non-array', () => {
				expect(() => testUser.logs = 'invalid' as any).toThrow();
			});

			it('cannot be set to an array containing non-EntityId items', () => {
				expect(() => (<any>testUser).logs = [{a:'blah'}]).toThrow();				
			});
		});

		describe('User Id', () => {
			it('can be set to a string', () => {
				const newId = uuidv4();
				testUser.userId = newId;
				expect(testUser.userId).toEqual(newId);
				expect(typeof testUser.userId).toEqual('string');
			});

			it('can be set to a number', () => {
				const newId = 42;
				testUser.userId = newId;
				expect(testUser.userId).toEqual(newId);
				expect(typeof testUser.userId).toEqual('number');
			});

			it('cannot be set to undefined', () => {
				expect(() => testUser.userId = undefined as any).toThrow();
			});

			it('cannot be set to null', () => {
				expect(() => testUser.userId = null as any).toThrow();
			});

			it('cannot be set to an object', () => {
				expect(() => testUser.userId = {a: 'blah'} as any).toThrow();
			});
		});

		it('provides a collection of validation rules', () => {
			const rules = User.getSanitizationRules();
			expect(rules).toBeDefined();
			const keys = Object.keys(rules);
			expect(keys.length).toBeGreaterThan(0);
			expect(keys).toContain('entityId'); // inherited from Entity
			expect(keys).toContain('logs'); // specific to TrainingLog
			//expect(keys).toContain('laps'); // specific to ConditioningLog
		});

		//Test any additional validation logic not covered by the setters here
	});

	describe('Modification', () => {
		it('can add a log', () => {
			// arrange
			const originalLength = testUser.logs.length;
			const newLog = uuidv4();
			
			// act
			testUser.addLog(newLog);
			
			// assert
			expect(testUser.logs.length).toEqual(originalLength + 1);
			expect(testUser.logs).toContain(newLog);
		});

		it('can remove a log', () => {
			// arrange
			const originalLength = testUser.logs.length;
			const logToRemove = testLogs[0];
			
			// act
			testUser.removeLog(logToRemove);

			// assert
			expect(testUser.logs.length).toEqual(originalLength - 1);
			expect(testUser.logs).not.toContain(logToRemove);
		});
	});

	describe('Equality comparison', () => {
		// Entity.equals() is tested in entity.class.spec.ts, so just test User.equals() here

		let other: User;

		beforeEach(() => {
			other = (User.create(testDTO, uuidv4(), undefined, undefined, false)).value as User;
		});

		it('returns true if equal (by value)', () => {
			other = testUser;
			expect(testUser.equals(other, false, false)).toBeTruthy();
		});	
		
		it('returns false if logs are not equal (by value)', () => {
			other.logs = [];
			expect(testUser.equals(other, false, false)).toBeFalsy();
		});

		it('returns false if user ids are not equal (by value)', () => {
			other.userId = uuidv4();
			expect(testUser.equals(other, false, false)).toBeFalsy();
		});
	});

	describe('Serialization', () => {
		it('can be serialized to UserDTO JSON', () => {
			const json = testUser.toJSON();
			delete json.createdOn; // CRUD dates not included in DTO
			delete json.updatedOn;
			expect(json).toEqual(testDTO);
		});
	});
});