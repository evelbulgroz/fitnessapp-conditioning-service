import { v4 as uuid } from 'uuid';

import { ActivityType } from "@evelbulgroz/fitnessapp-base";
import { AggregationQueryDTO, AggregationType, SampleRate } from '@evelbulgroz/time-series';

import { LogsAggregationQuery } from './logs-aggregation-query.model';
import { AggregationQuery } from './aggregation-query.model';
import { LogsQuery } from './logs-query.model';
import { LogsQueryDTO } from '../dtos/logs-query.dto';
import { LogsAggregationQueryDTO } from '../dtos/logs-aggregation-query.dto';

// NOTE: These tests are not exhaustive, but they should verify that the class is working as expected, and that the validation decorators are correctly applied.

describe('LogsAggregationQuery', () => {
	let aggregeationQuery: LogsAggregationQuery;
	let aggregeationQueryDTO: LogsAggregationQueryDTO;

	beforeEach(() => {
		const aggregationDto: AggregationQueryDTO = {
			aggregatedType: 'ConditioningLog',
			aggregatedProperty: 'duration',
			aggregatedValueUnit: 'ms',
			aggregationType: AggregationType.SUM,
			sampleRate: SampleRate.DAY
		};

		const logsQueryDto: LogsQueryDTO ={
			start: '2023-01-01T00:00:00.000Z',
			end: '2023-01-31T00:00:00.000Z',
			activity: ActivityType.RUN,
			userId: uuid(),
			sortBy: 'date',
			order: 'asc',
			page: 1,
			pageSize: 10,
		};

		aggregeationQueryDTO = {
			aggregation: aggregationDto,
			query: logsQueryDto
		};

		aggregeationQuery = new LogsAggregationQuery(aggregeationQueryDTO);
	});

	it('can be created with valid values', () => {
		expect(aggregeationQuery).toBeDefined();
		expect(aggregeationQuery).toBeInstanceOf(LogsAggregationQuery);
		expect(aggregeationQuery.aggregationQuery).toBeInstanceOf(AggregationQuery);
		expect(aggregeationQuery.logsQuery).toBeInstanceOf(LogsQuery);
	});
	
	it('can convert to JSON', () => {
		const query = new LogsAggregationQuery(aggregeationQueryDTO);
		const json = query.toJSON();
		expect(json).toEqual(aggregeationQueryDTO);
	});

	it('throws if setting aggregationQuery to value that is not an instance of AggregationQuery', () => {
		expect(() => aggregeationQuery.aggregationQuery = new Map() as any).toThrow('aggregation query must be an instance of AggregationQuery');
	});

	it('throws if setting aggregationQuery to undefined', () => {
		expect(() => aggregeationQuery.aggregationQuery = undefined as any).toThrow("aggregation query must be defined");
	});

	it('throws if setting aggregationQuery to null', () => {
		expect(() => aggregeationQuery.aggregationQuery = undefined as any).toThrow("aggregation query must be defined");
	});

	it('throws if setting logsQuery to value that is not an instance of LogsQuery', () => {
		expect(() => aggregeationQuery.logsQuery = new Map() as any).toThrow('logs query must be an instance of LogsQuery');
	});

	it('throws if setting logsQuery to undefined', () => {
		expect(() => aggregeationQuery.logsQuery = undefined as any).toThrow("logs query must be defined");
	});

	it('throws if setting logsQuery to null', () => {
		expect(() => aggregeationQuery.logsQuery = undefined as any).toThrow("logs query must be defined");
	});
});