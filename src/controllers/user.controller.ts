import { Controller } from '@nestjs/common';

@Controller('user')
export class UserController {
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
}

export default UserController;
