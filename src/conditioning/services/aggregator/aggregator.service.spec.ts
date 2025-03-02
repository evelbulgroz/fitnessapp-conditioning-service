import { TestingModule, Test } from "@nestjs/testing";

import { v4 as uuidv4 } from 'uuid';
import { AggregationType, SampleRate, TimeSeriesAggregator } from '@evelbulgroz/time-series';

import { AggregationQueryMapper } from '../../mappers/aggregation-query.mapper';
import { AggregatorService } from "./aggregator.service";
import { AggregationQueryDTO } from "../../dtos/aggregation-query.dto";

// NOTE: Just a quick test to check that the service can be created/injected and used:
// TimeSeriesAggregator is fully tested in @evelbulgroz/time-series, so no need to test it here.

describe('AggregatorService', () => {
	let aggregator: AggregatorService;
	
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AggregationQueryMapper,
				AggregatorService,
				TimeSeriesAggregator
			],
		}).compile();

		aggregator = module.get<AggregatorService>(AggregatorService);	
	});

	it('can be created', () => {
		expect(aggregator).toBeDefined();
	});
	
	it('can aggregate a timeseries', () => {
		// arrange
		const testSeries = {
			unit: 'Test Unit',
			data:  [
				{ timeStamp: '2023-09-14T08:00:00Z', value: { id: uuidv4(), duration: 60 } },
				{ timeStamp: '2023-09-14T14:00:00Z', value: { id: uuidv4(), duration: 45 } },
				{ timeStamp: '2023-09-15T10:00:00Z', value: { id: uuidv4(), duration: 30 } },
				{ timeStamp: '2023-09-16T12:00:00Z', value: { id: uuidv4(), duration: 75 } },
				{ timeStamp: '2023-09-22T08:00:00Z', value: { id: uuidv4(), duration: 0 } },
				{ timeStamp: '2023-10-15T14:00:00Z', value: { id: uuidv4(), duration: 60 } },
				{ timeStamp: '2023-10-16T10:00:00Z', value: { id: uuidv4(), duration: 45 } },
				{ timeStamp: '2023-11-05T08:00:00Z', value: { id: uuidv4(), duration: 30 } },
				{ timeStamp: '2023-11-15T12:00:00Z', value: { id: uuidv4(), duration: 75 } },
				{ timeStamp: '2024-03-03T08:00:00Z', value: { id: uuidv4(), duration: 90 } },
				{ timeStamp: '2024-04-01T14:00:00Z', value: { id: uuidv4(), duration: 60 } },
				{ timeStamp: '2024-04-15T10:00:00Z', value: { id: uuidv4(), duration: 45 } },
				{ timeStamp: '2025-02-20T08:00:00Z', value: { id: uuidv4(), duration: 30 } },
				{ timeStamp: '2025-03-15T12:00:00Z', value: { id: uuidv4(), duration: 75 } },
				{ timeStamp: '2025-12-24T08:00:00Z', value: { id: uuidv4(), duration: 90 } },
			  ]
		};
		
		const dto = new AggregationQueryDTO({
			aggregatedType: 'ConditioningLog', // only supported type
			aggregatedProperty: 'duration',
			aggregationType: AggregationType.SUM,
			sampleRate: SampleRate.YEAR
		});

		
		// act
		const aggregatedLogs = aggregator.aggregate(testSeries, dto);
		
		// assert
		expect(aggregatedLogs.data.length).toBe(3);
		expect(aggregatedLogs.data[0].value.aggregatedValue).toBe(420);
		expect(aggregatedLogs.data[1].value.aggregatedValue).toBe(195);
		expect(aggregatedLogs.data[2].value.aggregatedValue).toBe(195);
	});
});
