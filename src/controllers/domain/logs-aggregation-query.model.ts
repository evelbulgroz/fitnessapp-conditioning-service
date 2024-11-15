import { AggregationQuery } from "./aggregation-query.model";
import { LogsAggregationQueryDTO } from "../dtos/logs-aggregation-query.dto";
import { QueryDTO } from "../dtos/query.dto";

import { IsDefined, IsInstanceOf } from "@evelbulgroz/sanitizer-decorator";

/** Validates query parameters received by the 'aggregate' endpoint in a LogsAggregationQueryDTO object.
 * @remark Compound query object that includes both aggregation and logs query parameters
*/

export class LogsAggregationQuery {
	//----------------------------- PROPERTIES -----------------------------
	private _aggregationQuery: AggregationQuery;
	private _logsQuery: QueryDTO;

	//----------------------------- CONSTRUCTOR -----------------------------//
   
	constructor(dto: LogsAggregationQueryDTO) {
		// asssign to setters to trigger validation
		dto.aggregation && (this.aggregationQuery = new AggregationQuery(dto.aggregation));
		dto.query && (this.logsQuery = new QueryDTO(dto.query));
	}

	//----------------------------- PUBLIC METHODS -----------------------------//

	/** Convert the instance to a LogsAggregationQueryDTO object.
	 * @returns DTO object
	 */
	toJSON(): LogsAggregationQueryDTO {
		return {
			aggregation: this.aggregationQuery.toJSON(),
			query: this.logsQuery?.toJSON()
		};
	}

	//--------------------------- GETTERS/SETTERS ---------------------------//
	
	/** Aggregation parameters for the query */
	@IsDefined('', {message: 'aggregation query must be defined'})
	@IsInstanceOf(AggregationQuery, { message: 'aggregation query must be an instance of AggregationQuery' })
	set aggregationQuery(aggregation: AggregationQuery) { this._aggregationQuery = aggregation; }
	get aggregationQuery(): AggregationQuery { return this._aggregationQuery; }

	/** Logs selection parameters for the query */
	@IsDefined('', {message: 'logs query must be defined'})
	@IsInstanceOf(QueryDTO, { message: 'logs query must be an instance of LogsQuery' })
	set logsQuery(query: QueryDTO) { this._logsQuery = query; }
	get logsQuery(): QueryDTO { return this._logsQuery; }
}