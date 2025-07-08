import { Injectable } from '@nestjs/common';

import {
	AggregatedTimeSeries,
	AggregationQuery,
	DataPoint,
	TimeSeriesAggregator,
	TimeSeries
} from '@evelbulgroz/time-series';

import { AggregationQueryDTO } from '../../dtos/aggregation-query.dto';
import { AggregationQueryMapper } from '../../mappers/aggregation-query.mapper';

/**
 * Aggregates time series data by sample rate and aggregation type
 * 
 * @remark Injectable wrapper for TimeSeriesAggregator from @evelbulgroz/time-series
 * 
 * @todo Consider making generic so that it can be used without subclassing for different types of data e.g. sensor data, training logs, aggregated training data etc.
 * 
 */
@Injectable()
export class AggregatorService {
	//---------------------------------------- PROPERTIES ---------------------------------------------

	protected aggregator: TimeSeriesAggregator;
	protected mapper: AggregationQueryMapper<AggregationQuery, AggregationQueryDTO>;

	//---------------------------------------- CONSTRUCTOR --------------------------------------------

	public constructor() {
		this.aggregator = new TimeSeriesAggregator();
		this.mapper = new AggregationQueryMapper();
	}

	//--------------------------------- PUBLIC INSTANCE METHODS ---------------------------------------
	
	/**
	 * Aggregate time series data by sample rate and aggregation type
	 * 
	 * @typeparam T Type of object holding the data to aggregate, e.g. TrainingLog, SensorLog, etc. (must be indexable by string)
 	 * @typeparam U Type of the aggregated value, e.g. number for a simple sum (can be complex, but none currently implemented)
 	 * @param timeSeries The time series to aggregate
	 * @param aggregationQuery Validated aggregation query DTO
	 * @param valueExtractor Optional function to extract a numerical value from complex aggregated type, e.g. (item: TrainingLog) => item.duration.value
	 * 
	 * @returns An aggregated time series
	 * 
	 * @todo Refactor to take parsed AggregationQuery instead of DTO, to decouple from DTO validation (now)
	 * @todo Think through if time stamp should be start or end of period: take lead from needs of front end (later)
	 */
	public aggregate<T extends object, U extends number>(
		timeSeries: TimeSeries<T>,
		aggregationQuery: AggregationQuery,
		valueExtractor?: (dataPoint: DataPoint<T>) => U,
	): AggregatedTimeSeries<T, U> {		
		return this.aggregator.aggregate(timeSeries, aggregationQuery, valueExtractor);
	}
}

export default AggregatorService;