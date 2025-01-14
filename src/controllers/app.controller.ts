import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, getSchemaPath } from '@nestjs/swagger';

import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { AggregatedTimeSeries } from '@evelbulgroz/time-series';
import { EntityId, Logger } from '@evelbulgroz/ddd-base';

import { AggregationQueryDTO } from '../dtos/sanitization/aggregation-query.dto';
import { ConditioningData } from '../domain/conditioning-data.model';
import { ConditioningDataService } from '../services/conditioning-data/conditioning-data.service';
import { ConditioningLog } from '../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../dtos/domain/conditioning-log.dto';
import { DefaultStatusCodeInterceptor } from './interceptors/status-code.interceptor';

import { EntityIdDTO } from '../dtos/sanitization/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthResult } from '../services/jwt/models/jwt-auth-result.model';
import { LoggingGuard } from './guards/logging.guard';
import { PropertySanitizationDataDTO } from '@evelbulgroz/sanitizer-decorator';
import { QueryDTO } from '../dtos/sanitization/query.dto';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { TypeParamDTO } from '../dtos/sanitization/type-param.dto';
import { UserContext, UserContextProps } from '../domain/user-context.model';
//import { UserService } from '../services/user/user.service';
import { ValidationPipe } from './pipes/validation.pipe';

/** Main controller for the application.
 * @remark This controller is responsible for handling, parsing and sanitizing all incoming requests.
 * @remark It delegates the actual processing of data to the appropriate service methods, which are responsible for data access control, business logic and persistence.
 * @remark All endpoints are intended for use by front-end applications on behalf of authenticated users.
 * @todo Implement user CRUD operations
 */
@ApiTags('conditioning')
@ApiExtraModels(QueryDTO)
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
		private readonly LogService: ConditioningDataService,
		//private readonly userService: UserService
	) {}

	//------------------------------ SINGLE-LOG CRUD -----------------------------//
	
	@Post('log/:userId')
	@ApiOperation({ summary: 'Create a new conditioning log for a user' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	//@ApiBody({ type: ConditioningLogDTO }) // Assuming ConditioningLogDTO can be used for partial updates
	@ApiResponse({ status: 201, description: 'Log created successfully', type: EntityIdDTO })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async createLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
		@Body() logDTO: ConditioningLogDTO
	): Promise<EntityId> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			return await this.LogService.createLog(userContext, userIdDTO, logDTO); // Implement this method in your service
		} catch (error) {
			const errorMessage = `Failed to create log: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
	
	/**
	 * @example http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef
	 */
	@Get('log/:userId/:logId')
	@ApiOperation({ summary: 'Get detailed conditioning log by ID' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiParam({ name: 'logId', description: 'Log ID' })
	@ApiResponse({ status: 200, description: 'ConditioningLog object matching log ID, if found' })
	@ApiResponse({ status: 204, description: 'Log updated successfully, no content returned' })
	@ApiResponse({ status: 400, description: 'Request for log details failed' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({  whitelist: true, forbidNonWhitelisted: true,transform: true }))
	public async fetchLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
		@Param('logId') logId: EntityIdDTO
	): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			const log = this.LogService.fetchLog(userContext, userIdDTO, logId);
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
	
	@Patch('log/:userId/:logId')
	@ApiOperation({ summary: 'Update a conditioning log by user ID and log ID' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiParam({ name: 'logId', description: 'Log ID' })
	//@ApiBody({ type: ConditioningLogDTO }) // Assuming ConditioningLogDTO can be used for partial updates
	@ApiResponse({ status: 200, description: 'Log updated successfully' })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async updateLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
		@Param('logId') logIdDTO: EntityIdDTO,
		@Body() partialLogDTO: Partial<ConditioningLogDTO>
	): Promise<void> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			void await this.LogService.updateLog(userContext, userIdDTO, logIdDTO, partialLogDTO);
			// implicit return
		} catch (error) {
			const errorMessage = `Failed to update log with ID: ${logIdDTO.value}: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
	
	@Delete('log/:userId/:logId')
	@ApiOperation({ summary: 'Delete a conditioning log by ID' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiParam({ name: 'logId', description: 'Log ID' })
	@ApiResponse({ status: 204, description: 'Log deleted successfully, no content returned' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async deleteLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
		@Param('logId') logIdDTO: EntityIdDTO
	): Promise<void> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			void await this.LogService.deleteLog(userContext, userIdDTO, logIdDTO); // Implement this method in your service
		} catch (error) {
			const errorMessage = `Failed to delete log with id: ${logIdDTO.value}: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

	//---------------------------- BATCH LOG CRUD ---------------------------//

	@Get('logs/:userId')
	@ApiOperation({ summary: 'Get conditioning logs for all users (role = admin), or for a specific user (role = user)' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiQuery({	name: 'queryDTO', required: false, type: 'object', schema: { $ref: getSchemaPath(QueryDTO) }, description: 'Optional query parameters for filtering logs'})
	@ApiResponse({ status: 200, description: 'Array of ConditioningLogs, or empty array if none found' })
	@ApiResponse({ status: 400, description: 'Request for logs failed' })
	@ApiResponse({ status: 404, description: 'No logs found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async fetchLogs(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
		@Query() queryDTO?: QueryDTO
	): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps);
			// query is always instantiated by the http framework, even of no parameters are provided in the request:
			// therefore remove empty queries here, so that the service method can just check for undefined
			queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO;
			const logs = await this.LogService.fetchLogs(userContext, userIdDTO, queryDTO as any) ?? []; // todo: refactor service method to map QueryDTO to Query, then constrain type here
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

	//------------------------ TODO: SINGLE-USER CRUD -----------------------//

	/** Create a new user here when a user is created in the user microservice
	 * throws UnauthorizedException if requester is not user microservice
	 * @todo Implement this method in user service
	*/

	/*
	@Post()
	async createUser(@Body() createUserDTO: CreateUserDTO): Promise<void> {
		await this.userService.createUser(createUserDTO);
	}
	*/

	/* Delete a user here when the corresponding user is deleted in the user microservice
	 * throws UnauthorizedException if requester is not user microservice
	 * @todo Implement this method in user service
	 * @remark Should use soft delete to preserve logs until periodic cleanup; this may require changes to Repository base class
	 * @remark Restoration of deleted users beyond a certain time period will rely on backups 
	*/
	/*
	@Delete(':id')
		async deleteUser(@Param('id') userId: string): Promise<void> {
		await this.userService.deleteUser(userId);
	}
	*/
	
	//--------------------------------- MISC --------------------------------//

	/**
	 * @todo Throw error if user tries to access another user's data (e.g. by passing a user id in the request)
	*/
	@Get('activities')
	@ApiOperation({ summary: 'Get list of the number of times each conditioning activity has been logged' })
	@ApiResponse({ status: 200, description: 'Object with activity names as keys and counts as values' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async activities(@Req() req: any): Promise<Record<string, number>> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult			
			const activityCounts: Record<string, number> = {};			
			const logs = await this.LogService.fetchLogs(userContext, {} as unknown as EntityIdDTO) ?? [];
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
	@ApiOperation({ summary: 'Aggregate conditioning logs using aggregation parameters and optional logs query' })
	@ApiBody({ type: AggregationQueryDTO })
	@ApiQuery({	name: 'queryDTO', required: false, type: 'object', schema: { $ref: getSchemaPath(QueryDTO) }, description: 'Optional query parameters for filtering logs'})
	@ApiResponse({ status: 200, description: 'Aggregated conditioning data as AggregatedTimeSeries from time-series library' })
  	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted: true, transform: true }))
	public async aggregate(
		@Req() req: any,
		@Body() aggregationQueryDTO: AggregationQueryDTO,
		@Query() queryDTO?: QueryDTO
	): Promise<AggregatedTimeSeries<ConditioningLog<any, ConditioningLogDTO>, any>> { // todo: change return type to match service method
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			// query is always instantiated by the http framework, even of no parameters are provided in the request:
			// therefore remove empty queries here, so that the service method can just check for undefined
			queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO;
			return this.LogService.fetchaggretagedLogs(userContext, aggregationQueryDTO as any, queryDTO as any); // todo: refactor service method to accept dtos
		}
		catch (error) {
			const errorMessage = `Request for aggregation failed: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

	/**
	 * @example http://localhost:3060/api/v3/conditioning/rules?type=ConditioningLog
	*/
	@Get('rules/:type')
	@ApiOperation({ summary: 'Get all property rules for a supported type (e.g. for deserialization and validation of domain objects on front end)' })
	@ApiParam({ name: 'type', description: 'String name of entity type' })
	@ApiResponse({ status: 200, description: 'Rules object containing all own and inherited sanitization rules for the specified type (as PropertySanitizationDataDTO from sanitizer-decorator library)' })
	@ApiResponse({ status: 400, description: 'Invalid entity type' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async fetchValidationRules(@Param('type') type: TypeParamDTO): Promise<{	[key: string]: PropertySanitizationDataDTO[] }> {
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

	//------------------------------ DEPRECATED -----------------------------//
	
	/** IN PRODUCTION: Get all conditioning logs grouped by activity type and aggregated by duration and date
	 * @example http://localhost:3060/conditioning/api/v3/conditioning/sessions
	 * @todo Retire when frontend is updated to use the new, authenticated endpoints
	 */
	@Get('sessions')
	@ApiOperation({ summary: 'Get all conditioning logs grouped by activity type and aggregated by duration and date' })
	@ApiResponse({ status: 200, description: 'Conditioning data object' })
	//@Roles('admin', 'user')
	//@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async sessions(): Promise<ConditioningData> {
		try {
			return this.LogService.conditioningData();
		}
		catch (error) {
			throw new BadRequestException(`Request for all sessions failed: ${error.message}`);
		}
	}
}

export default AppController;