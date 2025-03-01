import { Injectable } from '@nestjs/common';
import { AggregationQuery } from '@evelbulgroz/time-series';

import { AggregationQueryDTO } from '../dtos/responses/aggregation-query.dto';
import { Mapper } from './mapper.model';

@Injectable()
export class AggregationQueryMapper<T extends AggregationQuery, U extends AggregationQueryDTO> extends Mapper<T,U> {
	constructor() {
		super();
	}
	
	//----------------------------- PUBLIC METHODS -----------------------------//
	
	/** Maps a DTO object to a model object */
	public toDomain(dto: U): T {
		return new AggregationQuery({
			aggregatedProperty: dto.aggregatedProperty,
			aggregatedType: dto.aggregatedType,
			aggregationType: dto.aggregationType,
			aggregatedValueUnit: dto.aggregatedValueUnit,
			sampleRate: dto.sampleRate
		}) as T;
	}
	
	// toDTO() method is not needed for this mapper
}

export default AggregationQueryMapper;