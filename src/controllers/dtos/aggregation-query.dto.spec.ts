import { AggregationQueryDTO } from './aggregation-query.dto';
import { AggregationQueryDTOProps } from '../../test/models/aggregation-query-dto.props';
import { AggregationType, SampleRate } from '@evelbulgroz/time-series';

// NOTE: These tests are not exhaustive, but they should verify that the class is working as expected, and that the validation decorators are correctly applied.

describe('AggregationQueryDTO', () => {
	let props: AggregationQueryDTOProps;

	beforeEach(() => {
		props = {
			aggregatedType: 'ConditioningLog',
			aggregatedProperty: 'laps',
			aggregatedValueUnit: 'ms',
			aggregationType: AggregationType.SUM,
			sampleRate: SampleRate.DAY
		};
	});

	it('can be created from valid data', () => {
		const query = new AggregationQueryDTO(props);
		expect(query.aggregatedType).toBe(props.aggregatedType);
		expect(query.aggregatedProperty).toBe(props.aggregatedProperty);
		expect(query.aggregatedValueUnit).toBe(props.aggregatedValueUnit);
		expect(query.aggregationType).toBe(props.aggregationType);
		expect(query.sampleRate).toBe(props.sampleRate);
	});

	it('can convert to JSON', () => {
		const query = new AggregationQueryDTO(props);
		expect(query.toJSON()).toEqual(props);
	});

	it('throws if aggregatedType is invalid', () => {
		props.aggregatedType = 'InvalidType';
		expect(() => new AggregationQueryDTO(props)).toThrow('aggregatedType must be one of the supported types: ConditioningLog');
	});

	it('throws if aggregatedProperty is invalid', () => {
		props.aggregatedProperty = 'invalidProperty';
		expect(() => new AggregationQueryDTO(props)).toThrow('aggregatedProperty must be a key of : ConditioningLog');
	});

	it('throws if aggregatedValueUnit is invalid', () => {
		props.aggregatedValueUnit = 'invalidUnit';
		expect(() => new AggregationQueryDTO(props)).toThrow('aggregatedValueUnit must be one of the supported units: ms, kg');
	});

	it('throws if aggregationType is invalid', () => {
		props.aggregationType = 'invalidType' as AggregationType;
		expect(() => new AggregationQueryDTO(props)).toThrow('aggregationType must be a valid aggregation type');
	});

	it('throws if sampleRate is invalid', () => {
		props.sampleRate = 'invalidRate' as SampleRate;
		expect(() => new AggregationQueryDTO(props)).toThrow('sampleRate must be a valid sample rate');
	});

	it('throws if aggregatedType is not set before aggregatedProperty', () => {
		const dtoWithoutType = { ...props, aggregatedType: undefined } as unknown as AggregationQueryDTO;
		expect(() => new AggregationQueryDTO(dtoWithoutType)).toThrow('aggregatedType must be set before aggregatedProperty');
	});
});