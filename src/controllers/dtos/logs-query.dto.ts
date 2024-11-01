import { ActivityType } from "@evelbulgroz/fitnessapp-base";
import { EntityId } from "@evelbulgroz/ddd-base";

/** Specifies the query parameters accepted by endpoints supporting log retrieval and aggregation */
export interface LogsQueryDTO {
	/** Start date for the log. */
	start?: string;

	/** End date for the log. */
	end?: string;

	/** Activity to filter logs by.	*/
	activity?: ActivityType;

	/** User id (issued by user microservice) to filter logs by. */
	userId?: EntityId;

	/** Property (key) to sort logs by. */
	sortBy?: string;

	/** Sort order for logs. */
	order?: 'asc' | 'desc';

	/** Page number for paginated results. */
	page?: number;

	/** Number of results per page. */
	pageSize?: number;
}

export default LogsQueryDTO;