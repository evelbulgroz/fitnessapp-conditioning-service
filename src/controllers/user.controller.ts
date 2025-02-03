import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Logger } from '@evelbulgroz/ddd-base';

import { EntityIdDTO } from '../dtos/sanitization/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthResult } from '../services/jwt/models/jwt-auth-result.model';
import { LoggingGuard } from './guards/logging.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { ServiceName } from '../dtos/sanitization/service-name.class';
import { UnauthorizedAccessError } from '../domain/unauthorized-access.error';
import { UserService } from '../services/user/user.service';
import { UserContext, UserContextProps } from '../domain/user-context.model';
import { ValidationPipe } from './pipes/validation.pipe';

/** Controller for user-related operations.
 * @remark This controller is responsible for handling user-related operations, such as creating a new user when a user is created in the user microservice.
 * @remark It delegates the actual processing of data to the appropriate data service methods, which are responsible for business logic and persistence.
 * @remark All endpoints are intended for use by the user microservice only, and are protected by authentication and role-based access control.
 * @remark Only stores the user id locally, which is immutable once set, so there is no need to support updating or retrieving other user data here.
 * @remark Documented using Swagger decorators for easy generation of OpenAPI documentation. No need to duplicate documentation for TypeDoc, hence fewer comments.
*/ 
@ApiTags('user') // version prefix set in main.ts
@Controller('user')
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	LoggingGuard // log all requests to the console
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
export class UserController {
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		private readonly config: ConfigService,
		private readonly logger: Logger,
		private readonly userService: UserService,		
	) { }

	//---------------------------------------- PUBLIC API ---------------------------------------//

	@Post(':userId')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: 'Create a new user', description: 'This endpoint is responsible for creating a new user in this service. It is intended for use by the user microservice only, to keep this service in sync, and is protected by authentication and role-based access control.' })
	@ApiParam({ name: 'userId', description: 'The user id in the user microservice' })
	@ApiResponse({ status: 201, description: 'User created successfully. Returns empty string as users should be referenced by their id in the user microservice, not their local id in this service.', type: String })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))		
	async createUser(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
	): Promise<void> {
		try {
			// sanitize user context 
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			
			// validate that request is from user microservice
			if(!this.isCallerUserMicroservice(userContext)) {
				this.logger.error(`Unauthorized: Only user microservice can create users`);
				throw new UnauthorizedAccessError('Unauthorized: Requester does not have permission to create user');
			}

			// validate that user role is authorized to create user
			if(!userContext.roles.includes('admin')) {
				this.logger.error(`Unauthorized: Only admin users can create users`);
				throw new UnauthorizedAccessError('Unauthorized: Requester does not have permission to create user');
			}
			
			// create user			
			void await this.userService.createUser(userContext, userIdDTO); // Implement this method in your service			
		} catch (error) {
			const errorMessage = `Failed to create user: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
		// clients do not need to known local entity id of new user -> return undefined
	}

	@Delete(':userId/')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete a user', description: 'This endpoint is responsible for deleting a user in this service. It is intended for use by the user microservice only, to keep this service in sync, and is protected by authentication and role-based access control.' })
	@ApiParam({ name: 'userId', description: 'The user id in the user microservice' })
	@ApiResponse({ status: 204, description: 'User deleted successfully. Returns empty string.', type: String })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	async deleteUser(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
		@Query('softDelete') softDelete: boolean = true,
	): Promise<void> {
		try {
			// sanitize user context 
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			
			// validate that request is from user microservice
			if(!this.isCallerUserMicroservice(userContext)) {
				this.logger.error(`Unauthorized: Only user microservice can delete users`);
				throw new UnauthorizedAccessError('Unauthorized: Requester does not have permission to delete user');
			}

			// delete user
			void await this.userService.deleteUser(userContext, userIdDTO, softDelete);
		} catch (error) {
			const errorMessage = `Failed to delete user: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
		// return undefined
	}

	@Patch(':userId/undelete')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Restore a user', description: 'This endpoint is responsible for restoring a previously soft deleted user in the system. It is intended for use by the user microservice only and is protected by authentication and role-based access control.' })
	@ApiParam({ name: 'userId', description: 'The user id in the user microservice' })
	@ApiResponse({ status: 204, description: 'User restored successfully' })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin')
	async undeleteUser(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,		
	): Promise<void> {
		try {
			// sanitize user context 
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult

			// validate that request is from user microservice
			if(!this.isCallerUserMicroservice(userContext)) {
				this.logger.error(`Unauthorized: Only user microservice can restore users`);
				throw new UnauthorizedAccessError('Unauthorized: Requester does not have permission to restore user');
			}

			// restore user
			await this.userService.undeleteUser(userContext, userIdDTO);
		}
		catch (error) {
			const errorMessage = `Failed to restore user: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

	//------------------------------------- PRITECTED METHODS -----------------------------------//

	/* Determine if the request was made by the user microservice
	 * @param userContext The user context of the request
	 * @returns True if the request was made by the user microservice, false otherwise
	 */
	protected isCallerUserMicroservice(userContext: UserContext): boolean {
		const safeRequestingServiceName = new ServiceName(userContext.userName);
		const expectedServiceName = new ServiceName(this.config.get<string>('security.collaborators.user.serviceName')!);
		return safeRequestingServiceName.equals(expectedServiceName);
	}
}

export default UserController;
