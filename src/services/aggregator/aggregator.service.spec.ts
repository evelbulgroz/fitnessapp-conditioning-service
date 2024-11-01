import { TestingModule, Test } from "@nestjs/testing";

import { v4 as uuidv4 } from 'uuid';

import { AggregatorService } from "./aggregator.service";
import { AggregationQuery, AggregationType, SampleRate } from '@evelbulgroz/time-series';

// NOTE: Just a quick test to check that the service can be created/injected and used:
// TimeSeriesAggregator is fully tested in @evelbulgroz/time-series, so no need to test it here.

describe('AggregatorService', () => {
	let aggregator: AggregatorService;
	
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AggregatorService],
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
		
		const dto = {
			aggregatedType: 'TestType',
			aggregatedProperty: 'duration',
			aggregationType: AggregationType.SUM,
			sampleRate: SampleRate.YEAR
		}

		const aggregationQuery = new AggregationQuery(dto);
		
		// act
		const aggregatedLogs = aggregator.aggregate(testSeries, aggregationQuery);
		
		// assert
		expect(aggregatedLogs.data.length).toBe(3);
		expect(aggregatedLogs.data[0].value.aggregatedValue).toBe(420);
		expect(aggregatedLogs.data[1].value.aggregatedValue).toBe(195);
		expect(aggregatedLogs.data[2].value.aggregatedValue).toBe(195);
	});
});
