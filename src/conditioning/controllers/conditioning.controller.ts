import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, getSchemaPath } from '@nestjs/swagger';

import { AggregatedTimeSeries } from '@evelbulgroz/time-series';
import { EntityId } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLoggableMixin } from '../../libraries/stream-loggable';
import AggregationQueryDTO from '../dtos/aggregation-query.dto';
import BooleanDTO from '../../shared/dtos/responses/boolean.dto';
import { ConditioningData } from '../domain/conditioning-data.model';
import ConditioningDataService from '../services/conditioning-data/conditioning-data.service';
import ConditioningLog from '../domain/conditioning-log.entity';
import ConditioningLogDTO from '../dtos/conditioning-log.dto';
import DefaultStatusCodeInterceptor from '../../infrastructure/interceptors/status-code.interceptor';
import DomainTypeDTO from '../../shared/dtos/responses/domain-type.dto';
import EntityIdDTO from '../../shared/dtos/responses/entity-id.dto';
import JwtAuthGuard from '../../infrastructure/guards/jwt-auth.guard';
import JwtAuthResult from '../../authentication/services/jwt/domain/jwt-auth-result.model';
import { PropertySanitizationDataDTO } from '@evelbulgroz/sanitizer-decorator';
import Public from '../../infrastructure/decorators/public.decorator';
import QueryDTO from '../../shared/dtos/responses/query.dto';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { UserContext, UserContextProps } from '../../shared/domain/user-context.model';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';

/** Controller serving requests for conditioning datap
 * @remark This controller is responsible for handling, parsing and sanitizing all incoming requests for conditioning data.
 * @remark It delegates the actual processing of data to the appropriate data service methods, which are responsible for business logic and persistence.
 * @remark All endpoints are intended for use by front-end applications on behalf of authenticated users.
 * @remark Documented using Swagger decorators for easy generation of OpenAPI documentation: 
 * - There is no need to duplicate this documentation for TypeDoc, hence fewer traditional comments.
 * @remark Streams logging using the {@link StreamLoggableMixin}, which provides a unified logging interface for all components.
 * @remark Does not implement {@link ManagedStatefulComponentMixin} as it does not manage any stateful components.
 * - Standard health checks are sufficient for this controller.
 * @todo Retire unsecured /session endpoint when all clients have migrated to JWT authentication.
 */
@ApiTags('conditioning')
@Controller('conditioning') // version prefix set in main.ts
@Roles('admin', 'user')
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
@UseInterceptors(new DefaultStatusCodeInterceptor(200)) // Set default status code to 200
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) // whitelisting ignored with primitive types
export class ConditioningController extends StreamLoggableMixin(class {}) {
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		private readonly dataService: ConditioningDataService,
		private readonly streamLogger: MergedStreamLogger,
	) {
		super();

		// Set up the logger for this component
		 // Workaround for not being able to get a reference to the active controller instance in the module.
		this.streamLogger.subscribeToStreams([
			{ streamType: 'log$', component: this }
		]);
	}

	//-------------------------------- PUBLIC API: SINGLE-LOG CRUD ------------------------------//
	
	@Post('log/:userId')
	@ApiOperation({
		summary: 'Create a new conditioning log for a user',
		description: 'Creates a new conditioning log for a user, returning the id of the new log. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef'
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiBody({ 
		type: ConditioningLog,
		description: 'Expects object that can be deserialized to a valid ConditioningLog. NOTE: Domain entities and DTOs prohibited from using 3rd party decorators, e.g. Swagger. Please refer to examples below instead. Please use the /rules endpoint to get fully detailed properties and validation rules for any supported domain entity.',
		examples: {
			'Example 1': {
				value: {
					activity: 'RUN',
					start: '2021-01-01T00:00:00Z',
					end: '2021-01-01T01:00:00Z',
					duration: 3600,
					distance: 10,
					date: '2021-01-01T00:00:00Z',
					note: 'Ran 10km in 1 hour',
					laps: [
						{ duration: 1800, distance: 5, notes: 'First half' },
						{ duration: 1800, distance: 5, notes: 'Second half' }
					],
					sensorLogs: [
						{ sensorType: 'HEARTRATE', unit: 'bpm', data: [{ timeStamp: '2021-01-01T00:00:00Z', value: 60 }, { timeStamp: '2021-01-01T00:30:00Z', value: 120 }] },
						{ sensorType: 'GEOLOCATION', unit: 'm', data: [{ timeStamp: '2021-01-01T00:00:00Z', value: { lat: 0, lon: 0 } }, { timeStamp: '2021-01-01T00:30:00Z', value: { lat: 0, lon: 0 } }] }
					]
				}
			}
		},
		required: true
	})
	@ApiResponse({ status: 200, description: 'Log created successfully', schema: { type: 'string' } })
	@ApiResponse({ status: 201, description: 'Log created successfully, new log ID returned' })
	@ApiResponse({ status: 204, description: 'Log created successfully, no content returned' })
	@ApiResponse({ status: 400, description: 'Invalid data, see log for details' })
	public async createLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
		@Body() logDTO: Record<string, any> // NestJS strips undecorated properties from the body, so we need to use a more basic type here
	): Promise<EntityId> {
		try {
			if (!userIdDTO || !logDTO) {				
				const errorMessage = 'User ID and log data are required';
				this.logger.error(errorMessage);
				throw new BadRequestException(errorMessage);
			}
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			const log = this.createLogFromDTO(logDTO); // validate the log DTO before passing it to the service
			return await this.dataService.createLog(
				userContext.userId, // requestingUserId
				userIdDTO.value, // targetUserId
				log, // log to create
				userContext.roles.includes('admin'), // isAdmin
			);
		} catch (error) {
			const errorMessage = `Failed to create log: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}
	
	@Get('log/:userId/:logId')
	@ApiOperation({
		summary: 'Get detailed conditioning log by ID',
		description: 'Returns a single conditioning log by ID, if found. Example request: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef. See /log POST endpoint for data example(s).'
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiParam({
		name: 'logId',
		description: 'Log ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiParam({
		name: 'includeDeleted',
		description: 'Include soft deleted logs in the response (true or false, optional, defaults to false)',
		required: false,
		type: 'boolean'
	})
	@ApiResponse({ status: 200, description: 'ConditioningLog object matching log ID, if found' })
	@ApiResponse({ status: 204, description: 'Log updated successfully, no content returned' })
	@ApiResponse({ status: 400, description: 'Request failed, see log for details' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	public async fetchLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
		@Param('logId') logIdDTO: EntityIdDTO,
		@Param('includeDeleted') includeDeletedDTO?: BooleanDTO
	): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		try {
			if (!userIdDTO || !logIdDTO) {
				const errorMessage = 'User ID and log ID are required';
				this.logger.error(errorMessage);
				throw new BadRequestException(errorMessage);
			}
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			const log = this.dataService.fetchLog(
				userContext.userId,
				userIdDTO.value,
				logIdDTO.value,
				userContext.roles.includes('admin'),
				includeDeletedDTO?.value ?? false // includeDeleted is optional, defaults to false
			);
			if (!log) {
				const errorMessage = `Log with id ${logIdDTO.value} not found`;
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
	
	/**
	 * @todo Reconsider if validating (partial) update DTO by creating a new ConditioningLog is too strict.
	 * - A partial update should not require all required properties to be present, but only validate the ones that are being updated.
	 * - Revisit this when sanitizer-decorator library improves support for validating partial updates.
	 */
	@Patch('log/:userId/:logId')
	@ApiOperation({
		summary: 'Update a conditioning log by user ID and log ID',
		description: 'Updates a conditioning log by user ID and log ID, returning no content. Example: http://localhost:3060/api/v3/conditioning/log/3e020b33-55e0-482f-9c52-7bf45b4276ef/3e020b33-55e0-482f-9c52-7bf45b4276ef. See /log POST endpoint for data example(s).'
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiParam({
		name: 'logId',
		description: 'Log ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiBody({ 
		type: ConditioningLog,
		description: 'Expects object that can be deserialized to (partial) ConditioningLog'
	})
	@ApiResponse({ status: 200, description: 'Log updated successfully' })
	@ApiResponse({ status: 204, description: 'Log updated successfully, no content returned' })
	@ApiResponse({ status: 400, description: 'Request failed, see log for details' })
	public async updateLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
		@Param('logId') logIdDTO: EntityIdDTO,
		@Body() partialLogDTO: Record<string, any>// Partial<ConditioningLogDTO> // NestJS strips undecorated properties from the body, so we need to use a more basic type here
	): Promise<void> {
		try {
			if (!userIdDTO || !logIdDTO || !partialLogDTO) {
				const errorMessage = 'User ID, log ID and (partial) log data are required';
				this.logger.error(errorMessage);
				throw new BadRequestException(errorMessage);
			}
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			const partialLog = this.createLogFromDTO(partialLogDTO); // validate the log DTO before passing it to the service
			void await this.dataService.updateLog(userContext, userIdDTO, logIdDTO, partialLog);
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
	@ApiParam({
		name: 'userId',
		description: 'User ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'}
	})
	@ApiParam({
		name: 'logId',
		description: 'Log ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiResponse({ status: 204, description: 'Log deleted successfully, no content returned' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	public async deleteLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
		@Param('logId') logIdDTO: EntityIdDTO
	): Promise<void> {
		try {
			if (!userIdDTO || !logIdDTO) {
				const errorMessage = 'User ID and log ID are required';
				this.logger.error(errorMessage);
				throw new BadRequestException(errorMessage);
			}
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			void await this.dataService.deleteLog(userContext, userIdDTO, logIdDTO);
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
	@ApiParam({
		name: 'userId',
		description: 'User ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiParam({
		name: 'logId',
		description: 'Log ID (string or number)',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiResponse({ status: 204, description: 'Log undeleted successfully, no content returned' })
	@ApiResponse({ status: 404, description: 'Log not found' })
	public async undeleteLog(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
		@Param('logId') logIdDTO: EntityIdDTO
	): Promise<void> {
		try {
			if (!userIdDTO || !logIdDTO) {
				const errorMessage = 'User ID and log ID are required';
				this.logger.error(errorMessage);
				throw new BadRequestException(errorMessage);
			}
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			void await this.dataService.undeleteLog(userContext, userIdDTO, logIdDTO);
		} catch (error) {
			const errorMessage = `Failed to undelete log with id: ${logIdDTO.value}: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}


	//---------------------------------- PUBLIC API: BATCH CRUD ---------------------------------//

	@Get('logs')
	@ApiOperation({
		summary: 'Get conditioning logs for all users (role = admin), or for a specific user (role = user)',
		description: 'Returns an array of conditioning logs for all users (role = admin), or for a specific user (role = user). Example request: http://localhost:56383/api/v3/conditioning/logs?userId=ddc97caa-faea-44aa-a351-79af7c394e29&includeDeleted=false&start=2021-01-01&end=2021-12-31&activity=MTB&sortBy=duration&order=ASC&page=1&pageSize=10. See /log POST endpoint for data example(s).'
	})
	@ApiQuery({
		name: 'userId',
		description: 'User ID (string or number, optional for admins)',
		required: false,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiQuery({
		name: 'includeDeleted',
		description: 'Include soft deleted logs (true or false, optional unless using query, defaults to false)',
		required: false,
		type: 'boolean'	
	})	
	@ApiQuery({
		name: 'queryDTO',
		required: false,
		type: 'object',
		schema: { $ref: getSchemaPath(QueryDTO) },
		description: 'Optional query parameters for filtering logs. Should not include duplicate userId or includeDeleted, or request will fail'
	})
	@ApiExtraModels(QueryDTO) // Trigger inclusion of QueryDTO in Swagger, getSchemaPath(QueryDTO) is not enough
	@ApiResponse({ status: 200, description: 'Array of ConditioningLogs, or empty array if none found' })
	@ApiResponse({ status: 400, description: 'Request for logs failed' })
	@ApiResponse({ status: 404, description: 'No logs found' })
	public async fetchLogs(
		@Req() req: any,
		@Query('userId') userIdDTO?: EntityIdDTO,
		@Query('includeDeleted') includeDeletedDTO?: BooleanDTO,
		@Query() queryDTO?: QueryDTO
	): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps);
			// all params are optional -> defer validation to the service method
			
			if (queryDTO) {// query always instantiated by framework, using all query params -> remove if empty except for userId and includeDeleted
				queryDTO.userId = undefined;
				(queryDTO as any).includeDeleted = undefined; // not currently part of queryDTO, remove just in case
				queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO; 
			}

			return await this.dataService.fetchLogs(
				userContext.userId,
				userIdDTO?.value,
				queryDTO,
				includeDeletedDTO?.value ?? false,
				userContext.roles.includes('admin')
			);
		}
		catch (error) {
			const errorMessage = `Request for logs failed: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

	//------------------------------------------- MISC ------------------------------------------//

	@Get('activities')
	@ApiOperation({
		summary: 'Get list of the number of times each conditioning activity has been logged for a single user, or all users (role = admin)',
		description: 'Returns an object with activity names as keys and counts as values. Example request: http://localhost:60741/api/v3/conditioning/activities?userId=1593d697-2dfc-4f29-8f4b-8c1f9343ef56&includeDeleted=false&start=2025-01-01T00:00:00Z&end=2025-01-31T23:59:59Z&activity=RUN&sortBy=date&order=ASC&page=1&pageSize=10. Example response: { RUN: 5, SWIM: 3, BIKE: 2 }'
	})
	@ApiQuery({
		name: 'userId',
		description: 'User ID (string or number, optional for admins)',
		required: false,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiQuery({
		name: 'includeDeleted',
		description: 'Include soft deleted logs in the count (true or false, optional unless using query, defaults to false)',
		required: false,
		type: 'boolean'
	})
	@ApiQuery({
		name: 'queryDTO',
		description: 'Optional query parameters for filtering logs. Should not include duplicate userId or includeDeleted, or request will fail',
		required: false,
		type: 'object', schema: { $ref: getSchemaPath(QueryDTO)},		
	})
	@ApiResponse({ status: 200, description: 'Object with activity names as keys and counts as values' })
	@ApiResponse({ status: 400, description: 'Request for activities failed' })
	@ApiResponse({ status: 404, description: 'No activities found' })
	public async activities(
		@Req() req: any,
		@Query('userId') userIdDTO?: EntityIdDTO,
		@Query('includeDeleted') includeDeletedDTO?: BooleanDTO,
		@Query() queryDTO?: QueryDTO,
	): Promise<Record<string, number>> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult	
			if (queryDTO) {// query always instantiated by framework, using all query params -> remove if empty except for userId and includeDeleted
				queryDTO.userId = undefined;
				(queryDTO as any).includeDeleted = undefined; // not currently part of queryDTO, remove just in case
				queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO; 
			}
			return await this.dataService.fetchActivityCounts(
				userContext.userId, // requestingUserId
				userIdDTO?.value, // targetUserId
				queryDTO, // query parameters for filtering logs
				userContext.roles.includes('admin'), // isAdmin
				includeDeletedDTO?.value // includeDeleted
			);
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
	@ApiBody({
		description: 'Aggregation parameters for conditioning logs',
		required: true,
		type: AggregationQueryDTO
	})
	@ApiQuery({
		name: 'queryDTO',
		description: 'Optional query parameters for filtering logs to aggregate',
		required: false,
		type: 'object', schema: { $ref: getSchemaPath(QueryDTO) }
	})
	@ApiResponse({ status: 200, description: 'Aggregated conditioning data as AggregatedTimeSeries from time-series library' })
	@ApiResponse({ status: 400, description: 'Request for aggregation failed' })
	public async aggregate(
		@Req() req: any,
		@Body() aggregationQueryDTO: AggregationQueryDTO,
		@Query() queryDTO?: QueryDTO
	): Promise<AggregatedTimeSeries<ConditioningLog<any, ConditioningLogDTO>, any>> {
		try {
			const userContext = new UserContext(req.user as JwtAuthResult as  UserContextProps); // maps 1:1 with JwtAuthResult
			// query is always instantiated by the http framework, even of no parameters are provided in the request:
			// therefore remove empty queries here, so that the service method can just check for undefined
			queryDTO = queryDTO?.isEmpty() ? undefined : queryDTO;
			return this.dataService.fetchAggretagedLogs(userContext.userId, aggregationQueryDTO as any, queryDTO as any); // todo: refactor service method to accept dtos
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
	@ApiParam({
		name: 'type',
		description: 'String name of entity type',
		required: true,
		schema: {
			type: 'string',
			example: 'ConditioningLog'
		}
	})
	@ApiResponse({ status: 200, description: 'Rules object containing all own and inherited sanitization rules for the specified type (as PropertySanitizationDataDTO from sanitizer-decorator library)' })
	@ApiResponse({ status: 400, description: 'Invalid entity type' })
	public async fetchValidationRules(@Param('type') type: DomainTypeDTO): Promise<{ [key: string]: PropertySanitizationDataDTO[] }> {
		switch (type.value) {
			case 'ConditioningLog':
				const rules = ConditioningLog.getSanitizationRules();
				return rules;
			default:
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
	@Public() // Disable authentication for this endpoint
	@UsePipes({ transform: () => undefined})  // Disable validation for this endpoint since it takes no parameters
	public async sessions(): Promise<ConditioningData> {
		try {
			return this.dataService.conditioningData();
		}
		catch (error) {
			throw new BadRequestException(`Request for all sessions failed: ${error.message}`);
		}
	}

	//------------------------------------ PROTECTED METHODS ------------------------------------//

	/* Create a ConditioningLog from a DTO before passing it to the data service
	 * @param logDTO The log (partial) DTO to create a log from
	 * @returns The created ConditioningLog
	 * @throws BadRequestException if the log DTO is invalid
	 * @remark This is also safe for partial updates, as long as log creation has no required fields
	 */
	protected createLogFromDTO(logDTO: Partial<ConditioningLogDTO>): ConditioningLog<any, ConditioningLogDTO> {
		const createResult = ConditioningLog.create(logDTO as ConditioningLogDTO);
		if (createResult.isFailure) {
			const errorMessage = `Invalid log data: ${createResult.error}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
		const log = createResult.value as ConditioningLog<any, ConditioningLogDTO>;
		return log;
	}
}

export default ConditioningController;