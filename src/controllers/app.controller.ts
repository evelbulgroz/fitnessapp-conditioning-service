import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
	UseInterceptors,
	UsePipes
} from '@nestjs/common';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { AggregationQuery, AggregationQueryDTO } from '@evelbulgroz/time-series';
import { EntityId, Logger } from '@evelbulgroz/ddd-base';

import { ConditioningData } from '../domain/conditioning-data.model';
import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { LogsAggregationQueryDTO } from './dtos/logs-aggregation-query.dto';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { Query as Query_, QueryDTO } from '@evelbulgroz/query-fns';
import { DefaultStatusCodeInterceptor } from './interceptors/status-code.interceptor';

import { EntityIdParam } from './domain/entityid-param.model';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthResult } from '../services/jwt/models/jwt-auth-result.model';
import { LoggingGuard } from './guards/logging.guard';
import { LogsQuery } from './domain/logs-query.model';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { TypeParam } from './domain/type-param.model';
import { UserContext, UserContextProps } from './domain/user-context.model';
import { ValidationPipe } from './pipes/validation.pipe';
import { LogsAggregationQuery } from './domain/logs-aggregation-query.model';

/** Main controller for the application.
 * @remarks This controller is responsible for handling, parsing and validating all incoming requests.
 * @remarks It delegates the actual processing of requests to the appropriate service methods, which are responsible for data access and business logic.
 * @remarks All endpoints are intended for use by front-end applications on behalf of authenticated users.
 */
@Controller() // set prefix in config
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	LoggingGuard // log all requests to the console
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
@UseInterceptors(new DefaultStatusCodeInterceptor(200)) // Set default status code to 200
export class AppController {
	constructor(
		private readonly logger: Logger,
		private readonly service: ConditioningDataService
	) {}

	/** Get list of the number of times each conditioning activity has been logged.
	 * @returns Object with activity names as keys and counts as values
	 * @throws BadRequestException if data service method fails
	 * @remarks Audience: Admins (all data), Users (own data) accessing endpoint from a front-end application
	 * @example http://localhost:3060/api/v3/conditioning/activities
	 * @todo Delegate processing to service method
	 
	*/
	@Get('activities')
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	async activities(): Promise<Record<string, number>> {
		try {
			const activityCounts: Record<string, number> = {};			
			const logs = await this.service.conditioningLogs();
			Object.keys(ActivityType).forEach(activity => {
				const count = logs.filter(log => log.activity === activity).length;
				activityCounts[activity] = count;
			});
			return activityCounts;
		}
		catch (error) {
			this.logger.error(`Request for activities failed: ${error.message}`);
			throw new BadRequestException(`Request for activities failed: ${error.message}`);
		}
	}

	/** Aggregate conditioning logs using aggregation parameters.
	 * @param query unvalidated aggregation parameters
	 * @returns aggregated data
	 * @remarks Audience: Admins, Users accessing their own data from a front-end application
	 * @todo Convert validation types here to types required by service method (e.g. AggregationQuery)
	 * @example http.post(http://localhost:3060/api/v3/conditioning/aggregate, {
		"aggregationQuery": {
			"aggregatedProperty": "duration",
			"aggregationType": "SUM",		
			"sampleRate": "DAY",
			"aggregatedValueUnit": "hour"
		},
		"dataQuery": {
			"searchCriteria": [
				{
					"operation": "EQUALS",
					"key": "activity",
					"value": "MTB",
					"negate": true
				}
			],
			"filterCriteria": [
				{
					"operation": "GREATER_THAN",
					"key": "duration",
					"value": "50000",
					"unit": "ms"
				}
			],
			"sortCriteria": [
				{
					"operation": "DESC",
					"key": "duration",
					"unit": "ms"
				}
			]
		},
	 });
	 */
	@Post('aggregate')
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ transform: true }))
	async aggregate(@Body() query: LogsAggregationQuery): Promise<any> {
		try {
			const aggregationQuery = query.aggregationQuery; // local AggregationQuery type/DTO
			// todo: convert query.dataQuery to ConditioningLogQuery
			const LogsQuery = query.logsQuery; // local LogsQuery type/DTO
			// todo: convert query.dataQuery to ConditioningLogQuery
			return this.service.aggretagedConditioningLogs(aggregationQuery, LogsQuery);
		}
		catch (error) {
			throw new BadRequestException(`Request for aggregation failed: ${error.message}`);
		}
	}

	/** Get conditioning log details by entity id.
	 * @param logId EntityIdParam object containing log entity id (mapped from 'id' request parameter)
	 * @returns ConditioningLog object matching log id, if found
	 * @throws BadRequestException if data service method fails
	 * @throws NotFoundException if no log is found with the specified id
	 * @remarks Data service method is responsible for role-based access control	 
	 * @example http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef
	 */
	@Get('log/:id')
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ transform: true }))
	async fetchLogDetails(@Req() req: any, @Param('id') logId: EntityIdParam ): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			const log = this.service.conditioningLogDetails(logId.value!, userContext as unknown as EntityId); // todo: refactor service method to accept user context
			if (!log) {
				const errorMessage = `Log with id ${logId.value} not found`;
				this.logger.error(errorMessage);
				throw new NotFoundException(errorMessage);
			}			
			return log;			
		}
		catch (error) {
			const errorMessage = `Request for log details failed: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
	
	/** Get conditioning logs for all users (role = admin), or for a specific user (role = user).
	 * @param query Query parameters for filtering logs (optional for admins, required with user id for normal users)
	 * @returns Array of ConditioningLogs, or empty array if none found
	 * @throws BadRequestException if user role or user id is not found in request, or user id does not match authenticated user
	 * @remarks If query is not provided (admin), or only contains user id (normal user), all applicable logs are returned
	 * @example http://localhost:3060/api/v3/conditioning/logs?activity=MTB&duration=50000
	 */	
	@Get('logs')
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	async fetchLogs(@Req() req: any, @Query() query?: LogsQuery): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps);		
			const logs = await this.service.conditioningLogs(query, userContext) ?? [];
			if (logs.length === 0) {
				const errorMessage = 'No logs found';
				this.logger.error(errorMessage);
				throw new NotFoundException(errorMessage);
			}
			return logs;
		}
		catch (error) {
			const errorMessage = `Request for logs failed: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}	
	}

	/** Get all property rules for a supported type (e.g. for deserialization and validation of domain objects). 
	 * @returns EntityRules object containing all rules for the specified type (as defined in ddd-base)
	 * @remarks Intended to enable front-end to performing preemptive validation w/o making a request to the server, but using the correct rules
	 * @example http://localhost:3060/api/v3/conditioning/rules?type=ConditioningLog
	*/
	@Get('rules/:type')
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	async fetchLogValidationRules(@Param('type') type: TypeParam): Promise<any> {
		switch (type.value) {
			case 'ConditioningLog':
				const rules = ConditioningLog.getSanitizationRules();
				return rules;
			default:
				// TypeParam should catch this, but just in case
				this.logger.error(`Invalid entity type: ${type.value}`);
				throw new BadRequestException(`Invalid entity type: ${type.value}`);
		}
	}
	
	/** IN PRODUCTION: Get all conditioning logs grouped by activity type and aggregated by duration and date
	 * @example http://localhost:3060/conditioning/api/v3/conditioning/sessions
	 * @todo Retire when frontend is updated to use the new, authenticated endpoints
	 */
	@Get('sessions')
	async sessions(): Promise<ConditioningData> {
		try {
			return this.service.conditioningData();
		}
		catch (error) {
			throw new BadRequestException(`Request for all sessions failed: ${error.message}`);
		}
	}
}

export default AppController;


/* For future reference: Convert JSON to query string
function jsonToQueryString(json: Record<string, any>): string {
  const queryString = Object.keys(json)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(json[key])}`)
    .join('&');
  return queryString;
}
*/