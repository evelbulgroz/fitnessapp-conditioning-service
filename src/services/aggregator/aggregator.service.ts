import { Injectable } from '@nestjs/common';

import {
	AggregatedTimeSeries,
	AggregationQuery as TimeSeriesAggregationQuery,
	DataPoint,
	TimeSeriesAggregator,
	TimeSeries
} from '@evelbulgroz/time-series';

import { AggregationQueryDTO } from '../../controllers/dtos/aggregation-query.dto';

/** Aggregates time series data by sample rate and aggregation type
* @remark This service is generic so that it can be used without subclassing for different types of data e.g. sensor data, training logs, aggregated training data etc.
 * @remark Injectable wrapper for TimeSeriesAggregator from @evelbulgroz/time-series
 */
@Injectable()
export class AggregatorService {
	//----------------------------------------CONSTRUCTOR----------------------------------------------

	public constructor(protected readonly _aggregator: TimeSeriesAggregator = new TimeSeriesAggregator()) {
		// nothing to do here!
	}

	//---------------------------------PUBLIC INSTANCE METHODS ----------------------------------------
	
	/** Aggregate time series data by sample rate and aggregation type
	 * @typeparam T Type of object holding the data to aggregate, e.g. TrainingLog, SensorLog, etc. (must be indexable by string)
 	 * @typeparam U Type of the aggregated value, e.g. number for a simple sum (can be complex, but none currently implemented)
 	 * @param timeSeries The time series to aggregate
	 * @param aggregationQuery Validated aggregation query DTO
	 * @param valueExtractor Optional function to extract a numerical value from complex aggregated type, e.g. (item: TrainingLog) => item.duration.value
	 * @returns An aggregated time series
	 * @todo Think through if time stamp should be start or end of period: take lead from needs of front end
	 */
	public aggregate<T extends object, U extends number>(
		timeSeries: TimeSeries<T>,
		aggregationQuery: AggregationQueryDTO,
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