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
//import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { Logger } from '@evelbulgroz/ddd-base';

import { AggregationQueryDTO } from './dtos/aggregation-query.dto';
import { ConditioningData } from '../domain/conditioning-data.model';
import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/conditioning-log.dto';
import { DefaultStatusCodeInterceptor } from './interceptors/status-code.interceptor';

import { EntityIdDTO } from './dtos/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthResult } from '../services/jwt/models/jwt-auth-result.model';
import { LoggingGuard } from './guards/logging.guard';
import { QueryDTO } from './dtos/query.dto';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { TypeParamDTO } from './dtos/type-param.dto';
import { UserContext, UserContextProps } from './domain/user-context.model';
import { ValidationPipe } from './pipes/validation.pipe';

/** Main controller for the application.
 * @remark This controller is responsible for handling, parsing and sanitizing all incoming requests.
 * @remark It delegates the actual processing of data to the appropriate service methods, which are responsible for data access control, business logic and persistence.
 * @remark All endpoints are intended for use by front-end applications on behalf of authenticated users.
 * @todo Implement API documentation using Swagger (OpenAPI) annotations and decorators (e.g. @ApiTags, @ApiOperation, @ApiResponse, @ApiQuery, @ApiParam)
 */
//@ApiTags('conditioning')
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
	 * @returns Object with activity names as keys and counts as values.
	 * @throws BadRequestException if data service method fails.
	 * @remark Audience: Admins (all data), Users (own data) accessing endpoint from a front-end application.
	 * @example http://localhost:3060/api/v3/conditioning/activities
	 * @todo Throw error if user tries to access another user's data (e.g. by passing a user id in the request)
	*/
	@Get('activities')
	//@ApiOperation({ summary: 'Get list of the number of times each conditioning activity has been logged' })
	//@ApiResponse({ status: 200, description: 'Object with activity names as keys and counts as values' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async activities(@Req() req: any): Promise<Record<string, number>> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult			
			const activityCounts: Record<string, number> = {};			
			const logs = await this.service.fetchLogs(userContext) ?? [];
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
	 * @param req Request object containing user context (mapped from JWT token)
	 * @param aggregationQueryDTO sanitized aggregation parameters
	 * @param queryDTO unvalidated aggregation parameters
	 * @returns aggregated data
	 * @example http.post(http://localhost:3060/api/v3/conditioning/aggregate,
	{ // aggregation query parameters
		"aggregatedType": "ConditioningLog",
		"aggregatedProperty": "duration",
		"aggregationType": "SUM",
		"sampleRate": "DAY",
		"aggregatedValueUnit": "ms"
	},
	{
		params: { // query parameters
			start: '2021-01-01',
			end: '2021-12-31',
			activity: ActivityType.MTB,
			userId: userContext.userId as unknown as string,
			sortBy: 'duration',
			order: 'ASC',
			page: 1,
			pageSize: 10,
		},
		headers: { // authorization header
			Authorization: `Bearer access-token`
		}
	});
	 */
	@Post('aggregate')
	//@ApiOperation({ summary: 'Aggregate conditioning logs using aggregation parameters' })
  	//@ApiResponse({ status: 200, description: 'Aggregated data' })
  	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted: true, transform: true }))
	public async aggregate(
		@Req() req: any,
		@Body() aggregationQueryDTO: AggregationQueryDTO,
		@Query() queryDTO?: QueryDTO
	): Promise<any> { // todo: change return type to match service method
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			// query is always instantiated by the http framework, even of no parameters are provided in the request:
			// therefore remove empty queries here, so that the service method can just check for undefined
			queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO;
			return this.service.fetchaggretagedLogs(userContext, aggregationQueryDTO as any, queryDTO as any); // todo: refactor service method to accept dtos
		}
		catch (error) {
			const errorMessage = `Request for aggregation failed: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

	/** Get detailed conditioning log by entity id.
	 * @param logId EntityId DTO wrapping log entity id (mapped from 'id' request parameter).
	 * @returns ConditioningLog object matching log id, if found.
	 * @throws BadRequestException if data service method fails.
	 * @throws NotFoundException if no log is found with the specified id.
	 * @example http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef
	 */
	@Get('log/:id')
	//@ApiOperation({ summary: 'Get conditioning log details by entity id' })
	//@ApiParam({ name: 'id', description: 'EntityIdParam object containing log entity id' })
	//@ApiResponse({ status: 200, description: 'ConditioningLog object matching log id, if found' })
	//@ApiResponse({ status: 404, description: 'Log not found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({  whitelist: true, forbidNonWhitelisted: true,transform: true }))
	public async fetchLog(@Req() req: any, @Param('id') logId: EntityIdDTO ): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			const log = this.service.fetchLog(userContext, logId);
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
	 * @param queryDTO Query parameters for filtering logs (optional for admins, required with user id for normal users)
	 * @returns Array of ConditioningLogs, or empty array if none found
	 * @throws BadRequestException if user role or user id is not found in request, or user id does not match authenticated user
	 * @remark If query is not provided (admin), or only contains user id (normal user), all applicable logs are returned
	 * @example http://localhost:3060/api/v3/conditioning/logs?activity=MTB&duration=50000
	 */	
	@Get('logs')
	//@ApiOperation({ summary: 'Get conditioning logs for all users (role = admin), or for a specific user (role = user)' })
	//@ApiQuery({ name: 'activity', required: false, type: String, description: 'Activity to filter logs by' })
	//@ApiQuery({ name: 'duration', required: false, type: Number, description: 'Duration to filter logs by' })
	//@ApiResponse({ status: 200, description: 'Array of ConditioningLogs, or empty array if none found' })
	//@ApiResponse({ status: 404, description: 'No logs found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async fetchLogs(@Req() req: any, @Query() queryDTO?: QueryDTO): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps);
			// query is always instantiated by the http framework, even of no parameters are provided in the request:
			// therefore remove empty queries here, so that the service method can just check for undefined
			queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO;
			const logs = await this.service.fetchLogs(userContext, queryDTO as any) ?? []; // todo: refactor service method to map QueryDTO to Query, then constrain type here
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

	/** Get all property sanitization rules for a supported type (e.g. for deserialization and validation of domain objects). 
	 * @returns Rules object containing all sanitization rules for the specified type (as defined by own and inherited property decorators).
	 * @throws BadRequestException if requested type is not supported.
	 * @remark Intended to enable front-end to performing preemptive validation w/o making a request to the server, while using the correct rules.
	 * @example http://localhost:3060/api/v3/conditioning/rules?type=ConditioningLog
	*/
	@Get('rules/:type')
	//@ApiOperation({ summary: 'Get all property rules for a supported type' })
	//@ApiParam({ name: 'type', description: 'TypeParam object containing entity type' })
	//@ApiResponse({ status: 200, description: 'EntityRules object containing all rules for the specified type' })
	//@ApiResponse({ status: 400, description: 'Invalid entity type' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async fetchValidationRules(@Param('type') type: TypeParamDTO): Promise<any> {
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
	public async sessions(): Promise<ConditioningData> {
		try {
			return this.service.conditioningData();
		}
		catch (error) {
			throw new BadRequestException(`Request for all sessions failed: ${error.message}`);
		}
	}
}

export default AppController;