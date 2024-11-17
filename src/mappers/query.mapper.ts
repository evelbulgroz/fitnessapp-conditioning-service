import { Injectable } from '@nestjs/common';
import { Mapper } from './mapper.model';
import { Query, SearchFilterOperation, SortOperation } from '@evelbulgroz/query-fns';
import { QueryDTO } from '../controllers/dtos/query.dto';
import { ConditioningLog } from 'src/domain/conditioning-log.entity';
import { ConditioningLogDTO } from 'src/dtos/conditioning-log.dto';

@Injectable()
export class QueryMapper<T extends Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>, U extends QueryDTO> extends Mapper<T,U> {
	constructor() {
		super();
	}
	
	//----------------------------- PUBLIC METHODS -----------------------------//
	
	/** Maps a DTO object to a model object */
	public toDomain(dto: U): T {
		const query = new Query<T,U>({
			searchCriteria: [
				{
					operation: SearchFilterOperation['GREATER_THAN'],
					key: 'start',
					value: dto.start,
					inclusive: true
				},
				{
					operation: SearchFilterOperation['LESS_THAN'],
					key: 'end',
					value: dto.end,
					inclusive: true
				},
				{
					operation: SearchFilterOperation['EQUALS'],
					key: 'activity',
					value: dto.activity
				},
				{
					operation: SearchFilterOperation['EQUALS'],
					key: 'userId',
					value: dto.userId
				}
			].filter((criterion) => criterion.value !== undefined), // all dto fields are optional, so filter out undefined values
			
			filterCriteria: [
				// no way to distinguish search and filter criteria in DTO, so all are treated as search criteria,
				// leaving this empty for now
			],//filter((criterion) => criterion.key! !== undefined), // all dto fields are optional, so filter out undefined values
			
			sortCriteria: [
				{
					operation: SortOperation[dto.order ?? 'ASC'],
					key: dto.sortBy ?? 'start',
				}
			].filter((criterion) => criterion.key !== undefined) // all dto fields are optional, so filter out undefined values
		});

		return query as unknown as T; // todo: figure out if this cast can be avoided
	}
	
	// toDTO() method is not needed for this mapper
}