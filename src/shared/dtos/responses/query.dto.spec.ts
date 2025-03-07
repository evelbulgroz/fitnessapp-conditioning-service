import { v4 as uuid } from 'uuid';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';

import { QueryDTO, QueryDTOProps } from './query.dto';

// NOTE: Does not cover every case, but should be acceptable for now

describe('QueryDTO', () => {
	let props: QueryDTOProps;

	beforeEach(() => {
		props = {
			start: '2023-01-01T00:00:00.000Z',
			end: '2023-01-31T00:00:00.000Z',
			activity: ActivityType.RUN,
			userId: uuid(),
			sortBy: 'date',
			order: 'ASC',
			page: 1,
			pageSize: 10,
		};
	});

	it('can be created with valid data', () => {
		const queryDTO = new QueryDTO(props);
		expect(queryDTO).toBeInstanceOf(QueryDTO);
		expect(queryDTO.start).toEqual(new Date(props.start!));
		expect(queryDTO.end).toEqual(new Date(props.end!));
		expect(queryDTO.activity).toEqual(props.activity);
		expect(queryDTO.userId).toEqual(props.userId);
		expect(queryDTO.sortBy).toEqual(props.sortBy);
		expect(queryDTO.order).toEqual(props.order);
		expect(queryDTO.page).toEqual(props.page);
		expect(queryDTO.pageSize).toEqual(props.pageSize);
	});

	it('can convert to JSON', () => {
		const queryDTO = new QueryDTO(props);
		expect(queryDTO.toJSON()).toEqual(props);
	});

	it('throws an error for invalid start date', () => {
		props.start = 'invalid-date';
		expect(() => new QueryDTO(props)).toThrow('Could not convert start to a date');
	});

	it('throws an error if start date is after end date', () => {
		const query = new QueryDTO(props);		
		expect(() => query.start = new Date('2023-02-01')).toThrow('start must be before end');
	});

	it('throws an error for invalid end date', () => {
		props.end = 'invalid-date';
		expect(() => new QueryDTO(props)).toThrow('Could not convert end to a date');
	});

	it('throws an error if end date is before start date', () => {
		const query = new QueryDTO(props);
		expect(() => query.end = new Date('2022-12-31')).toThrow('end must be after start');
	});

	it('throws an error for invalid activity type', () => {
		props.activity = 'invalid-activity' as any;
		expect(() => new QueryDTO(props)).toThrow('activity must be a valid activity type');
	});

	it('throws an error for invalid userId', () => {
		props.userId = 'a'.repeat(101);
		expect(() => new QueryDTO(props)).toThrow('userId must have less than 100 characters');
	});

	it('throws an error for invalid sortBy', () => {
		props.sortBy = 'a'.repeat(101);
		expect(() => new QueryDTO(props)).toThrow('sortBy must have less than 100 characters');
	});

	it('throws an error for invalid order', () => {
		props.order = 'invalid-order' as any;
		expect(() => new QueryDTO(props)).toThrow('order must be "ASC" or "DESC"');
	});

	it('throws an error for invalid page number', () => {
		props.page = 101;
		expect(() => new QueryDTO(props)).toThrow('page must be less than 100');
	});

	it('throws an error for invalid page size', () => {
		props.pageSize = 101;
		expect(() => new QueryDTO(props)).toThrow('pageSize must be less than 100');
	});

	it('can report if it is empty', () => {
		const query = new QueryDTO(props);
		expect(query.isEmpty()).toBe(false);
		expect(new QueryDTO({}).isEmpty()).toBe(true);
	});
});