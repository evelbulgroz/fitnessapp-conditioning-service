import { Injectable } from '@nestjs/common';

import {
	AggregatedTimeSeries,
	AggregationQuery as TimeSeriesAggregationQuery,
	DataPoint,
	TimeSeriesAggregator,
	TimeSeries
} from '@evelbulgroz/time-series';

import { AggregationQuery } from '../../controllers/domain/aggregation-query.model';

/**@description Aggregates time series data by sample rate and aggregation type
 * @note This service is generic so that it can be used for different types of data e.g. sensor data, training logs, aggregated training data etc.
 * @note Injectable wrapper for TimeSeriesAggregator from @evelbulgroz/time-series
 */
@Injectable()
export class AggregatorService {
	protected _aggregator: TimeSeriesAggregator;
	
	//----------------------------------------CONSTRUCTOR----------------------------------------------

	public constructor() {
		this._aggregator = new TimeSeriesAggregator();
	}

	//---------------------------------PUBLIC INSTANCE METHODS ----------------------------------------
	
	/** Aggregate time series data by sample rate and aggregation type
	 * @typeparam T Type which has a property holding the data, e.g. TrainingLog, SensorLog, etc. (must be indexable by string)
 	 * @typeparam U Type of the aggregated value, e.g. number for a simple sum (can be complex, but none currently implemented)
	 * @param timeSeries The time series to aggregate
	 * @param aggregationQuery Validated aggregation query DTO
	 * @param valueExtractor Optional function to extract a numerical value from complex aggregated type, e.g. (item: TrainingLog) => item.duration.value
	 * @returns An aggregated time series
	 * @remarks Aggregator functions could be made generic so that they can be used with different types of data
	 * @remarks Injectable wrapper for TimeSeriesAggregator from @evelbulgroz/time-series
	 * @todo Think through if time stamp should be start or end of period: take lead from needs of front end
	 */
	public aggregate<T extends { [key: string]: any }, U>(
		timeSeries: TimeSeries<T>,
		aggregationQuery: AggregationQuery,
		valueExtractor?: (dataPoint: DataPoint<T>) => U,
	): AggregatedTimeSeries<T, U> {		
		const timeSeriesAggregationQuery = new TimeSeriesAggregationQuery({ // map local aggregation query to time series aggregation query
			aggregatedProperty: aggregationQuery.aggregatedProperty,
			aggregatedType: aggregationQuery.aggregatedType,
			aggregationType: aggregationQuery.aggregationType,
			aggregatedValueUnit: aggregationQuery.aggregatedValueUnit,
			sampleRate: aggregationQuery.sampleRate
	});	
		return this._aggregator.aggregate(timeSeries, timeSeriesAggregationQuery, valueExtractor);
	}
}

export default AggregatorService;