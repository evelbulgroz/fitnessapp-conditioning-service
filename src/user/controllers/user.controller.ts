import { BadRequestException, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { MergedStreamLogger, StreamLoggableMixin } from '../../libraries/stream-loggable';

import JwtAuthGuard from '../../infrastructure/guards/jwt-auth.guard';
import JwtAuthResult from '../../authentication/services/jwt/domain/jwt-auth-result.model';
import RolesGuard from '../../infrastructure/guards/roles.guard';
import Roles from '../../infrastructure/decorators/roles.decorator';
import ServiceNameDTO from '../../shared/dtos/responses/service-name.dto';
import SoftDeleteDTO from '../../shared/dtos/requests/soft-delete.dto';
import UnauthorizedAccessError from '../../shared/domain/unauthorized-access.error';
import UserDataService from '../services/user-data.service';
import { UserContext, UserContextProps } from '../../shared/domain/user-context.model';
import UserIdDTO from '../../shared/dtos/requests/user-id.dto';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';

/** Controller for user-related operations.
 * @remark This controller is responsible for handling user-related operations, such as creating a new user when a user is created in the user microservice.
 * @remark It delegates the actual processing of data to the appropriate data service methods, which are responsible for business logic and persistence.
 * @remark All endpoints are intended for use by the user microservice only, and are protected by authentication and role-based access control.
 * @remark Only stores the user id locally, which is immutable once set, so there is no need to support updating or retrieving other user data here.
 * @remark Documented using Swagger decorators for easy generation of OpenAPI documentation. No need to duplicate documentation for TypeDoc, hence fewer traditional comments.
 * @remark Streams logging using the {@link StreamLoggableMixin}, which provides a unified logging interface for all components.
 * @remark Does not implement {@link ManagedStatefulComponentMixin} as it does not manage any stateful components.
 * - Standard health checks are sufficient for this controller.
 * @todo Move ValidationPipe to controller level once global validation pipe is implemented
*/ 
@ApiTags('user') // version prefix set in main.ts
@Controller('user')
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
export class UserController extends StreamLoggableMixin(class {}) {
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		private readonly config: ConfigService,
		private readonly userService: UserDataService,
		private readonly streamLogger: MergedStreamLogger,
	) {
		super();

		// Set up the logger for this component
		 // Workaround for not being able to get a reference to the active controller instance in the module.
		 this.streamLogger.subscribeToStreams([
			{ streamType: 'log$', component: this }
		]);
	}

	//---------------------------------------- PUBLIC API ---------------------------------------//

	@Post(':userId')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new user',
		description: 'This endpoint is responsible for creating a new user in this service. It is intended for use by the user microservice only, to keep this service in sync, and is protected by authentication and role-based access control. Example: (POST) http://localhost:56536/api/v3/user/e9f0491f-1cd6-433d-8a58-fe71d198c049'
	})
	@ApiParam({
		name: 'userId',
		description: 'The user id in the user microservice',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'e9f0491f-1cd6-433d-8a58-fe71d198c049'
		}
	})
	@ApiResponse({ status: 201, description: 'User created successfully. Returns empty string as users should be referenced by their id in the user microservice, not their local id in this service.', type: String })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))		
	async createUser(
		@Req() req: any,
		@Param('userId') userIdDTO: UserIdDTO,
	): Promise<void> {
		try {
			// sanitize user context 
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			const isAdmin = userContext.roles.includes('admin');

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
			void await this.userService.createUser(userContext.userName, userIdDTO.value, isAdmin); // Implement this method in your service			
		} catch (error) {
			const errorMessage = `Failed to create user: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
		// clients do not need to known local entity id of new user -> return undefined
	}

	@Delete(':userId/')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete a user',
		description: 'This endpoint is responsible for deleting a user in this service. It is intended for use by the user microservice only, to keep this service in sync, and is protected by authentication and role-based access control. Example: (DELETE) http://localhost:56919/api/v3/user/8ae14ed8-c4d3-4e42-b171-2668e752b900'
	})
	@ApiParam({
		name: 'userId',
		description: 'The user id in the user microservice',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: '8ae14ed8-c4d3-4e42-b171-2668e752b900'
		}
	})
	@ApiResponse({ status: 204, description: 'User deleted successfully. Returns empty string.', type: String })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	async deleteUser(
		@Req() req: any,
		@Param('userId') userIdDTO: UserIdDTO,
		@Query('softDelete') softDeleteDTO?: SoftDeleteDTO
		,
	): Promise<void> {
		try {
			// sanitize user context 
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			const isAdmin = userContext.roles.includes('admin');

			// validate that request is from user microservice
			if(!this.isCallerUserMicroservice(userContext)) {
				this.logger.error(`Unauthorized: Only user microservice can delete users`);
				throw new UnauthorizedAccessError('Unauthorized: Requester does not have permission to delete user');
			}

			// delete user
			void await this.userService.deleteUser(
				userContext.userName,
				userIdDTO.userId,
				softDeleteDTO?.softDelete ?? true, // default to soft delete
				isAdmin
			);
		} catch (error) {
			const errorMessage = `Failed to delete user: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
		// return undefined
	}

	@Patch(':userId/undelete')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Undelete a user',
		description: 'This endpoint is responsible for undeleting (i.e. restoring) a previously soft deleted user in the system. It is intended for use by the user microservice only and is protected by authentication and role-based access control. Example: (PATCH) http://localhost:57049/user/ab7b5cfb-7bc3-42c5-b6a0-82155ec717c0/undelete'
	 })
	@ApiParam({
		name: 'userId',
		description: 'The user id in the user microservice',
		required: true,
		schema: {
			type: 'string',
			format: 'uuid',
			example: 'ab7b5cfb-7bc3-42c5-b6a0-82155ec717c0'
		}
	})
	@ApiResponse({ status: 204, description: 'User undeleted successfully' })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin')
	async undeleteUser(
		@Req() req: any,
		@Param('userId') userIdDTO: UserIdDTO,		
	): Promise<void> {
		try {
			// sanitize user context 
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			const isAdmin = userContext.roles.includes('admin');

			// validate that request is from user microservice
			if(!this.isCallerUserMicroservice(userContext)) {
				this.logger.error(`Unauthorized: Only user microservice can restore users`);
				throw new UnauthorizedAccessError('Unauthorized: Requester does not have permission to restore user');
			}

			// restore user
			await this.userService.undeleteUser(userContext.userName, userIdDTO.value, isAdmin);
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
		const safeRequestingServiceName = new ServiceNameDTO(userContext.userName);
		const expectedServiceName = new ServiceNameDTO(this.config.get<string>('security.collaborators.user.serviceName')!);
		return safeRequestingServiceName.equals(expectedServiceName);
	}
}

export default UserController;
