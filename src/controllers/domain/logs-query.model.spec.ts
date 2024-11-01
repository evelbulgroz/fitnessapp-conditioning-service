import { LogsQuery } from './logs-query.model';
import { LogsQueryDTO } from '../dtos/logs-query.dto';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';

import { v4 as uuid } from 'uuid';

// NOTE: Does not cover every case, but should be acceptable for now

describe('LogsQuery', () => {
	let validDTO: LogsQueryDTO;

	beforeEach(() => {
		validDTO = {
			start: '2023-01-01T00:00:00.000Z',
			end: '2023-01-31T00:00:00.000Z',
			activity: ActivityType.RUN,
			userId: uuid(),
			sortBy: 'date',
			order: 'asc',
			page: 1,
			pageSize: 10,
		};
	});

	it('can be created with valid data', () => {
		const logsQuery = new LogsQuery(validDTO);
		expect(logsQuery).toBeInstanceOf(LogsQuery);
		expect(logsQuery.start).toEqual(new Date(validDTO.start!));
		expect(logsQuery.end).toEqual(new Date(validDTO.end!));
		expect(logsQuery.activity).toEqual(validDTO.activity);
		expect(logsQuery.userId).toEqual(validDTO.userId);
		expect(logsQuery.sortBy).toEqual(validDTO.sortBy);
		expect(logsQuery.order).toEqual(validDTO.order);
		expect(logsQuery.page).toEqual(validDTO.page);
		expect(logsQuery.pageSize).toEqual(validDTO.pageSize);
	});

	it('can convert to JSON', () => {
		const logsQuery = new LogsQuery(validDTO);
		expect(logsQuery.toJSON()).toEqual(validDTO);
	});

	it('throws an error for invalid start date', () => {
		validDTO.start = 'invalid-date';
		expect(() => new LogsQuery(validDTO)).toThrow('Could not convert start to a date');
	});

	it('throws an error if start date is after end date', () => {
		const query = new LogsQuery(validDTO);		
		expect(() => query.start = new Date('2023-02-01')).toThrow('start must be before end');
	});

	it('throws an error for invalid end date', () => {
		validDTO.end = 'invalid-date';
		expect(() => new LogsQuery(validDTO)).toThrow('Could not convert end to a date');
	});

	it('throws an error if end date is before start date', () => {
		const query = new LogsQuery(validDTO);
		expect(() => query.end = new Date('2022-12-31')).toThrow('end must be after start');
	});

	it('throws an error for invalid activity type', () => {
		validDTO.activity = 'invalid-activity' as any;
		expect(() => new LogsQuery(validDTO)).toThrow('activity must be a valid activity type');
	});

	it('throws an error for invalid userId', () => {
		validDTO.userId = 'a'.repeat(101);
		expect(() => new LogsQuery(validDTO)).toThrow('userId must have less than 100 characters');
	});

	it('throws an error for invalid sortBy', () => {
		validDTO.sortBy = 'a'.repeat(101);
		expect(() => new LogsQuery(validDTO)).toThrow('sortBy must have less than 100 characters');
	});

	it('throws an error for invalid order', () => {
		validDTO.order = 'invalid-order' as any;
		expect(() => new LogsQuery(validDTO)).toThrow('order must be "asc" or "desc"');
	});

	it('throws an error for invalid page number', () => {
		validDTO.page = 101;
		expect(() => new LogsQuery(validDTO)).toThrow('page must be less than 100');
	});

	it('throws an error for invalid page size', () => {
		validDTO.pageSize = 101;
		expect(() => new LogsQuery(validDTO)).toThrow('pageSize must be less than 100');
	});
});