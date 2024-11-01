import { AggregationQueryDTO} from "@evelbulgroz/time-series";
import { LogsQueryDTO } from "src/controllers/dtos/logs-query.dto";

/** Specifies the properties required by the 'aggregate' endpoint */
export interface LogsAggregationQueryDTO {
	aggregation: AggregationQueryDTO;
	query?: LogsQueryDTO
}

export default LogsAggregationQueryDTO;