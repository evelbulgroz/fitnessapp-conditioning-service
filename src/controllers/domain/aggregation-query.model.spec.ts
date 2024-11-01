import { AggregationQuery } from './aggregation-query.model';
import { AggregationQueryDTO, AggregationType, SampleRate } from '@evelbulgroz/time-series';

// NOTE: These tests are not exhaustive, but they should verify that the class is working as expected, and that the validation decorators are correctly applied.

describe('AggregationQuery', () => {
	let validDto: AggregationQueryDTO;

	beforeEach(() => {
		validDto = {
			aggregatedType: 'ConditioningLog',
			aggregatedProperty: 'laps',
			aggregatedValueUnit: 'ms',
			aggregationType: AggregationType.SUM,
			sampleRate: SampleRate.DAY
		};
	});

	it('can be created from valid data', () => {
		const query = new AggregationQuery(validDto);
		expect(query.aggregatedType).toBe(validDto.aggregatedType);
		expect(query.aggregatedProperty).toBe(validDto.aggregatedProperty);
		expect(query.aggregatedValueUnit).toBe(validDto.aggregatedValueUnit);
		expect(query.aggregationType).toBe(validDto.aggregationType);
		expect(query.sampleRate).toBe(validDto.sampleRate);
	});

	it('can convert to JSON', () => {
		const query = new AggregationQuery(validDto);
		expect(query.toJSON()).toEqual(validDto);
	});

	it('throws if aggregatedType is invalid', () => {
		validDto.aggregatedType = 'InvalidType';
		expect(() => new AggregationQuery(validDto)).toThrow('aggregatedType must be one of the supported types: ConditioningLog');
	});

	it('throws if aggregatedProperty is invalid', () => {
		validDto.aggregatedProperty = 'invalidProperty';
		expect(() => new AggregationQuery(validDto)).toThrow('aggregatedProperty must be a key of : ConditioningLog');
	});

	it('throws if aggregatedValueUnit is invalid', () => {
		validDto.aggregatedValueUnit = 'invalidUnit';
		expect(() => new AggregationQuery(validDto)).toThrow('aggregatedValueUnit must be one of the supported units: ms, kg');
	});

	it('throws if aggregationType is invalid', () => {
		validDto.aggregationType = 'invalidType' as AggregationType;
		expect(() => new AggregationQuery(validDto)).toThrow('aggregationType must be a valid aggregation type');
	});

	it('throws if sampleRate is invalid', () => {
		validDto.sampleRate = 'invalidRate' as SampleRate;
		expect(() => new AggregationQuery(validDto)).toThrow('sampleRate must be a valid sample rate');
	});

	it('throws if aggregatedType is not set before aggregatedProperty', () => {
		const dtoWithoutType = { ...validDto, aggregatedType: undefined } as unknown as AggregationQueryDTO;
		expect(() => new AggregationQuery(dtoWithoutType)).toThrow('aggregatedType must be set before aggregatedProperty');
	});
});