import { QueryDTO } from './query.dto';
import { LogsQueryDTO } from '../dtos/logs-query.dto';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';

import { v4 as uuid } from 'uuid';

// NOTE: Does not cover every case, but should be acceptable for now

describe('QueryDTO', () => {
	let json: Record<string, any>;

	beforeEach(() => {
		json = {
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
		const logsQuery = new QueryDTO(json);
		expect(logsQuery).toBeInstanceOf(QueryDTO);
		expect(logsQuery.start).toEqual(new Date(json.start!));
		expect(logsQuery.end).toEqual(new Date(json.end!));
		expect(logsQuery.activity).toEqual(json.activity);
		expect(logsQuery.userId).toEqual(json.userId);
		expect(logsQuery.sortBy).toEqual(json.sortBy);
		expect(logsQuery.order).toEqual(json.order);
		expect(logsQuery.page).toEqual(json.page);
		expect(logsQuery.pageSize).toEqual(json.pageSize);
	});

	it('can convert to JSON', () => {
		const logsQuery = new QueryDTO(json);
		expect(logsQuery.toJSON()).toEqual(json);
	});

	it('throws an error for invalid start date', () => {
		json.start = 'invalid-date';
		expect(() => new QueryDTO(json)).toThrow('Could not convert start to a date');
	});

	it('throws an error if start date is after end date', () => {
		const query = new QueryDTO(json);		
		expect(() => query.start = new Date('2023-02-01')).toThrow('start must be before end');
	});

	it('throws an error for invalid end date', () => {
		json.end = 'invalid-date';
		expect(() => new QueryDTO(json)).toThrow('Could not convert end to a date');
	});

	it('throws an error if end date is before start date', () => {
		const query = new QueryDTO(json);
		expect(() => query.end = new Date('2022-12-31')).toThrow('end must be after start');
	});

	it('throws an error for invalid activity type', () => {
		json.activity = 'invalid-activity' as any;
		expect(() => new QueryDTO(json)).toThrow('activity must be a valid activity type');
	});

	it('throws an error for invalid userId', () => {
		json.userId = 'a'.repeat(101);
		expect(() => new QueryDTO(json)).toThrow('userId must have less than 100 characters');
	});

	it('throws an error for invalid sortBy', () => {
		json.sortBy = 'a'.repeat(101);
		expect(() => new QueryDTO(json)).toThrow('sortBy must have less than 100 characters');
	});

	it('throws an error for invalid order', () => {
		json.order = 'invalid-order' as any;
		expect(() => new QueryDTO(json)).toThrow('order must be "asc" or "desc"');
	});

	it('throws an error for invalid page number', () => {
		json.page = 101;
		expect(() => new QueryDTO(json)).toThrow('page must be less than 100');
	});

	it('throws an error for invalid page size', () => {
		json.pageSize = 101;
		expect(() => new QueryDTO(json)).toThrow('pageSize must be less than 100');
	});
});