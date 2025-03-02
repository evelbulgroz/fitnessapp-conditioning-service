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

/** Aggregates time series data by sample rate and aggregation type
* @remark This service is generic so that it can be used without subclassing for different types of data e.g. sensor data, training logs, aggregated training data etc.
 * @remark Injectable wrapper for TimeSeriesAggregator from @evelbulgroz/time-series
 */
@Injectable()
export class AggregatorService {
	//----------------------------------------CONSTRUCTOR----------------------------------------------

	public constructor(
		protected readonly aggregator: TimeSeriesAggregator,
		protected readonly mapper: AggregationQueryMapper<AggregationQuery,AggregationQueryDTO>
	) {
		// nothing to do here!
	}

	//---------------------------------PUBLIC INSTANCE METHODS ----------------------------------------
	
	/** Aggregate time series data by sample rate and aggregation type
	 * @typeparam T Type of object holding the data to aggregate, e.g. TrainingLog, SensorLog, etc. (must be indexable by string)
 	 * @typeparam U Type of the aggregated value, e.g. number for a simple sum (can be complex, but none currently implemented)
 	 * @param timeSeries The time series to aggregate
	 * @param aggregationQueryDTO Validated aggregation query DTO
	 * @param valueExtractor Optional function to extract a numerical value from complex aggregated type, e.g. (item: TrainingLog) => item.duration.value
	 * @returns An aggregated time series
	 * @todo Think through if time stamp should be start or end of period: take lead from needs of front end
	 */
	public aggregate<T extends object, U extends number>(
		timeSeries: TimeSeries<T>,
		aggregationQueryDTO: AggregationQueryDTO,
		valueExtractor?: (dataPoint: DataPoint<T>) => U,
	): AggregatedTimeSeries<T, U> {		
		const agregationQuery = this.mapper.toDomain(aggregationQueryDTO);
		return this.aggregator.aggregate(timeSeries, agregationQuery, valueExtractor);
	}
}

export default AggregatorService;