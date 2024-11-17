import { ActivityType } from "@evelbulgroz/fitnessapp-base";

/** Represents the properties of logs query JSON data submitted in a request
 * @remarks Mostly used for testing
 * - request data is transformed directly into a QueryDTO instance by the controller
 */
export interface QueryDTOProps {
	start?: string;
	end?: string;
	activity?: ActivityType;
	userId?: string;
	sortBy?: string;
	order?: 'ASC' | 'DESC';
	page?: number;
	pageSize?: number;
}

export default QueryDTOProps;