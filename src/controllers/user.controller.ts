import { BadRequestException, Body, Controller, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Logger } from '@evelbulgroz/ddd-base';

import { EntityIdDTO } from '../dtos/sanitization/entity-id.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthResult } from '../services/jwt/models/jwt-auth-result.model';
import { LoggingGuard } from './guards/logging.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserService } from '../services/user/user.service';
import { UserContext, UserContextProps } from '../domain/user-context.model';
import { ValidationPipe } from './pipes/validation.pipe';

/** Controller for user-related operations.
 * @remark This controller is responsible for handling user-related operations, such as creating a new user when a user is created in the user microservice.
 * @remark It delegates the actual processing of data to the appropriate service methods, which are responsible for data access control, business logic and persistence.
 * @remark All endpoints are intended for use by the user microservice only, and are protected by authentication and role-based access control.
 * @remark Only stores the user id locally, which is immutable once set, so there is no need to support updating or retrieving users here.
*/ 
@ApiTags('user')
@Controller('user')
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	LoggingGuard // log all requests to the console
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
export class UserController {
	constructor(
		private readonly config: ConfigService,
		private readonly logger: Logger,
		private readonly userService: UserService,		
	) { }

	@Post(':userId')
	@ApiOperation({ summary: 'Create a new user', description: 'This endpoint is responsible for creating a new user in the system. It is intended for use by the user microservice only, to keep this service in sync, and is protected by authentication and role-based access control.' })
	@ApiParam({ name: 'userId', description: 'The user id in the user microservice' })
	@ApiResponse({ status: 201, description: 'User created successfully. Returns empty string as users should be referenced by their id in the user microservice, not their local id in this service.', type: String })
	@ApiResponse({ status: 400, description: 'Invalid data' })
	@Roles('admin', 'user')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))		
	async createUser(
		@Req() req: any,
		@Param('userId') userIdDTO: EntityIdDTO,
	): Promise<void> {
		try {
			// check if user is authorized to create a user
			const userContext = new UserContext(req.user as JwtAuthResult as UserContextProps); // maps 1:1 with JwtAuthResult
			
			// validate that request is from user microservice
			console.debug('UserContext:', userContext);
			/*if (!userContext.isMicroservice) {
				throw new BadRequestException('Unauthorized: requester is not a microservice');
			}*/
			
			
			void await this.userService.createUser(userContext, userIdDTO); // Implement this method in your service
			// return void, clients do not need to known local entity id of new user
		} catch (error) {
			const errorMessage = `Failed to create user: ${error.message}`;
			this.logger.error(errorMessage);
			throw new BadRequestException(errorMessage);
		}
	}

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
}

export default UserController;
