import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
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
import { ValidationPipe } from './pipes/validation.pipe';

/** Controller serving requests for conditioning data
 * @remark This controller is responsible for handling, parsing and sanitizing all incoming requests for conditioning data.
 * @remark It delegates the actual processing of data to the appropriate data service methods, which are responsible for business logic and persistence.
 * @remark All endpoints are intended for use by front-end applications on behalf of authenticated users.
 * @remark Documented using Swagger decorators for easy generation of OpenAPI documentation.
 * @remark No need to duplicate documentation for TypeDoc, hence fewer traditional comments.
 */
@ApiTags('conditioning')
@ApiExtraModels(QueryDTO)
@Controller('conditioning') // version prefix set in main.ts
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	LoggingGuard // log all requests to the console
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
@UseInterceptors(new DefaultStatusCodeInterceptor(200)) // Set default status code to 200
export class ConditioningController {
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		private readonly logger: Logger,
		private readonly LogService: ConditioningDataService,
	) {}

	//-------------------------------- PUBLIC API: SINGLE-LOG CRUD ------------------------------//
	
	@Post('log/:userId')
	@ApiOperation({
		summary: 'Create a new conditioning log for a user',
		description: 'Creates a new conditioning log for a user, returning the id of the new log. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef'
	})
	@ApiParam({ name: 'userId', description: 'User ID (string or number)' })
	@ApiBody({ description: 'type: ConditioningLogDTO'}) // Assuming ConditioningLogDTO can be used for partial updates
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
			this.validateLogDTO(logDTO); // manually validate the log DTO before passing it to the service (throws if invalid)
			return await this.LogService.createLog(userContext, userIdDTO, logDTO);
		} catch (error) {
			const errorMessage = `Failed to create log: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
	
	@Get('log/:userId/:logId')
	@ApiOperation({
		summary: 'Get detailed conditioning log by ID',
		description: 'Returns a single conditioning log by ID, if found. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef'
	})
	@ApiParam({ name: 'userId', description: 'User ID (string or number)' })
	@ApiParam({ name: 'logId', description: 'Log ID (string or number)' })
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
	@ApiOperation({
		summary: 'Update a conditioning log by user ID and log ID',
		description: 'Updates a conditioning log by user ID and log ID, returning no content. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef/3e020b33-55e0-482f-9c52-7bf45b4276ef'
	})
	@ApiParam({ name: 'userId', description: 'User ID (string or number)' })
	@ApiParam({ name: 'logId', description: 'Log ID (string or number)' })
	@ApiBody({ description: 'type: ConditioningLogDTO'}) // Assuming ConditioningLogDTO can be used for partial updates
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
			this.validateLogDTO(partialLogDTO); // manually validate the log DTO before passing it to the service (throws if invalid)
			void await this.LogService.updateLog(userContext, userIdDTO, logIdDTO, partialLogDTO);
			// implicit return
		} catch (error) {
			const errorMessage = `Failed to update log with ID: ${logIdDTO.value}: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
	
	@Delete('log/:userId/:logId')
	@ApiOperation({
		summary: 'Delete a conditioning log by ID',
		description: 'Deletes a conditioning log by ID, returning no content. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef/3e020b33-55e0-482f-9c52-7bf45b4276ef'

	})
	@ApiParam({ name: 'userId', description: 'User ID (string or number)' })
	@ApiParam({ name: 'logId', description: 'Log ID (string or number)' })
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

	@Patch('log/:userId/:logId/undelete')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Undelete a conditioning log by ID',
		description: 'Undeletes a conditioning log by ID, returning no content. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef/3e020b33-55e0-482f-9c52-7bf45b4276ef/undelete'
	})
	@ApiParam({ name: 'userId', description: 'User ID (string or number)' })
	@ApiParam({ name: 'logId', description: 'Log ID (string or number)' })
	@ApiResponse({ status: 204, description: 'Log undeleted successfully, no content returned' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	public async undeleteLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
		@Param('logId') logIdDTO: EntityIdDTO
	): Promise<void> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			void await this.LogService.undeleteLog(userContext, userIdDTO, logIdDTO);
		} catch (error) {
			const errorMessage = `Failed to undelete log with id: ${logIdDTO.value}: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}


	//---------------------------------- PUBLIC API: BATCH CRUD ---------------------------------//

	@Get('logs/:userId')
	@ApiOperation({
		summary: 'Get conditioning logs for all users (role = admin), or for a specific user (role = user)',
		description: 'Returns an array of conditioning logs for all users (role = admin), or for a specific user (role = user). Example: http://localhost:3060/api/v3/conditioning/logs/3e020b33-55e0-482f-9c52-7bf45b4276ef'
	})
	@ApiParam({ name: 'userId', description: 'User ID (string or number)' })
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

	//------------------------------------------- MISC ------------------------------------------//

	/**
	 * @todo Throw error if user tries to access another user's data (e.g. by passing a user id in the request)
	*/
	@Get('activities')
	@ApiOperation({
		summary: 'Get list of the number of times each conditioning activity has been logged',
		description: 'Returns an object with activity names as keys and counts as values. Example: http://localhost:3060/api/v3/conditioning/activities'
	})
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

	@Post('aggregate')
	@ApiOperation({
		summary: 'Aggregate conditioning logs using aggregation parameters and optional logs query',
		description: 'Aggregates conditioning logs using aggregation parameters and optional logs query. Example: http://localhost:3060/api/v3/conditioning/aggregate'
	})
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
			return this.LogService.fetchAggretagedLogs(userContext, aggregationQueryDTO as any, queryDTO as any); // todo: refactor service method to accept dtos
		}
		catch (error) {
			const errorMessage = `Request for aggregation failed: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

	@Get('rules/:type')
	@ApiOperation({
		summary: 'Get all property rules for a supported type (e.g. for deserialization and validation of domain objects on front end)',
		description: 'Returns all property rules for a supported type (e.g. for deserialization and validation of domain objects on front end). Example: http://localhost:3060/api/v3/conditioning/rules?type=ConditioningLog'
	})
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

	//---------------------------------------- DEPRECATED ---------------------------------------//
	
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

	//------------------------------------ PROTECTED METHODS ------------------------------------//

	/** Validate a ConditioningLogDTO before passing it to the data service
	 * @param logDTO The log DTO to validate
	 * @throws BadRequestException if the log DTO is invalid
	 * @remarks ConditioningLogDTO inherits from ddd-base the distinction between untrusted DTOs (interfaces) and trusted domain objects (classes),
	 * @remarks which breaks with the controller notion of DTOs as trusted data objects. This method bridges the gap by validating the DTO before passing it to the service.
	 * @remarks This as a matter of principple, and at a slight performance cost, as ddd-base Repository methods also validate new data before persisting it.
	 */
	protected validateLogDTO(logDTO: Partial<ConditioningLogDTO>): void {
		const createResult = ConditioningLog.create(logDTO as ConditioningLogDTO);
		if (createResult.isFailure) {
			const errorMessage = `Invalid log data: ${createResult.error}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
}

export default ConditioningController;