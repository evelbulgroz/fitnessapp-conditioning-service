import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { Entity, EntityId, Logger } from '@evelbulgroz/ddd-base';
import { Query, SearchFilterOperation } from '@evelbulgroz/query-fns';

import { EntityIdDTO } from '../../dtos/sanitization/entity-id.dto';
import { NotFoundError } from '../../domain/not-found.error';
import { PersistenceError } from '../../domain/persistence.error';
import { UnauthorizedAccessError } from '../../domain/unauthorized-access.error';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../domain/user-context.model';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user.repo';

/** Processes User CRUD events received from the User microservice.
 * @remark The user microservice holds all business data for the user, name, contact info, etc.
 * @remark The user entity in this microservice serves only to match a user's id in the user microservice to the ids of the logs the user has created here.
 * @remark This microservice acts as slave to the user microservice re. user management.
 * @remark Therefore, this service only needs to process create, delete and undelete events received as domain events from the user microservice.
 * @remark Relies on the User repository for chaching and persistence of user entities.
 */
@Injectable()
export class UserService {
	//----------------------------------- PRIVATE PROPERTIES ------------------------------------//
		
	protected isInitializing = false; // flag to indicate whether initialization is in progress, to avoid multiple concurrent initializations		
	protected readonly subscriptions: Subscription[] = []; // array to hold subscriptions to unsubsribe on destroy

	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		protected readonly config: ConfigService,
		protected readonly logger: Logger,
		protected readonly userRepo: UserRepository
	) {}

	//------------------------------------- LIFECYCLE HOOKS -------------------------------------//

	onModuleDestroy() {
		this.logger.log(`${this.constructor.name}: Shutting down...`);
		this.subscriptions.forEach((subscription) => subscription?.unsubscribe());
	}
	
	//---------------------------------------- PUBLIC API ---------------------------------------//
	
	/** Check if service is ready to use, i.e. has been initialized
	 * @returns Promise that resolves when the service is ready to use
	*/	
	public async isReady(): Promise<boolean> {
		const readyResult = await this.userRepo.isReady();
		if (readyResult.isFailure) {
			throw new PersistenceError(`Failed to check if service is ready: ${readyResult.error}`);			
		}
		return readyResult.value as boolean;
	}

	/** Create a new user and persists it in the User repository
	 * @param ctx The user context for the user to be created
	 * @param userIdDTO The user id in the user microservice of the user to be created
	 * @returns A promise that resolves to the new (local) user id when the user has been created
	 * @throws An error if the user id is not defined
	 * @throws An error if the user entity could not be created in the repository
	 * @remark Intended to be mostly triggered by a user create event received from the user microservice
	 * @remark Created user holds both entity unique to this microservice and the user id from the user microservice
	 * @remark Caller is expected to catch, handle and log any errors
	*/
	public async createUser(ctx: UserContext, userIdDTO: EntityIdDTO): Promise<EntityId> {
		// do common checks
		await this.isReady();
		this.checkIsValidCaller(ctx, 'createUser');
		this.checkIsValidId(userIdDTO, 'createUser');

		// check if user already exists in the repository
		const users = await this.findUserByMicroserviceId(userIdDTO.value! as string);
		if (users && users.length > 0) {
			throw new PersistenceError(`User entity with id ${userIdDTO.value} already exists`);
		}
		
		// request valid -> create new user
		const dto: UserDTO = { className: 'User', userId: userIdDTO.value!,	};
		const createResult = await this.userRepo.create(dto);
		if (createResult.isFailure) {
			throw new PersistenceError(`Failed to create user entity: ${createResult.error}`);
		}

		// creation successful -> return the new user id
		const user = createResult.value as User;
		return user.entityId!;
	}

	/** Delete a user entity and remove it in the User repository
	 * @param ctx The user context for the user to be deleted
	 * @param userIdDTO The user id in the user microservice of the user to be deleted
	 * @param softDelete Whether to soft delete (default) or hard delete the user entity
	 * @returns A promise that resolves when the user entity has been deleted
	 * @remark Intended to be mostly triggered by a user delete event received from the user microservice
	 * @remark Caller is expected to catch, handle and log any errors
	 */
	public async deleteUser(ctx: UserContext, userIdDTO: EntityIdDTO, softDelete = true): Promise<void> {
		// do common checks
		await this.isReady();
		this.checkIsValidCaller(ctx, 'deleteUser');
		this.checkIsValidId(userIdDTO, 'deleteUser');
		const user = await this.getUniqueUser(userIdDTO, 'deleteUser');
		
		// check if user is already soft deleted and soft delete is requested
		if (softDelete && user.deletedOn !== undefined) {
			return Promise.resolve(); // user is already soft deleted, return void
		}

		// delete the user entity in the user repository
		const deleteResult = await this.userRepo.delete(user.entityId!, softDelete);
		if (deleteResult.isFailure) {
			throw new PersistenceError(`Failed to delete user entity: ${deleteResult.error}`);
		}

		// deletion successful -> return void
		return Promise.resolve();
	}

	/** Undelete a user entity in the User repository (if soft deleted)
	 * @param ctx The user context for the user to be undeleted
	 * @param userIdDTO The user id in the user microservice of the user to be undeleted
	 * @returns A promise that resolves when the user entity has been undeleted
	 * @throws An error if the user id is not defined
	 * @throws An error if the user entity could not be undeleted in the repository
	 * @throws An error if the user entity is not soft deleted
	 * @remark Intended to be mostly triggered by a user undelete event received from the user microservice
	 * @remark Caller is expected to catch, handle and log any errors
	 */
	public async undeleteUser(ctx: UserContext, userIdDTO: EntityIdDTO): Promise<void> {
		// do common checks
		await this.isReady();
		this.checkIsValidCaller(ctx, 'undeleteUser');
		this.checkIsValidId(userIdDTO, 'undeleteUser');
		const user = await this.getUniqueUser(userIdDTO, 'undeleteUser');
		
		// check if user is soft deleted 
		if (user.deletedOn === undefined) {
			return Promise.resolve(); // user is not soft deleted, return void
		}

		// undelete the user entity in the user repository
		const undeleteResult = await this.userRepo.undelete(user.entityId!);
		if (undeleteResult!.isFailure) {
			throw new PersistenceError(`Failed to delete user entity: ${undeleteResult!.error}`);
		}

		// undeletion successful -> return void
		return Promise.resolve();
	}

	//------------------------------------ PROTECTED METHODS ------------------------------------//

	/* Check if caller is authorized to access a method
	 * @param ctx The user context for the caller
	 * @param userIdDTO The user id in the user microservice of the user to be accessed
	 * @param callerName The name of the method being accessed
	 * @returns True if the caller is authorized, false if not
	 * @throws An error if the caller is not authorized to access the method
	 * @remark Intended to be used by other methods to check if the caller is authorized to access the method
	 */
	protected checkIsValidCaller(ctx: UserContext, callerName: string): boolean {
		let userServiceName = this.config.get<any>('security.collaborators.user.serviceName');
		if (ctx.userName !== userServiceName || !ctx.roles.includes('admin')) {
			throw new UnauthorizedAccessError(`User ${ctx.userName} not authorized to access ${this.constructor.name}.${callerName}`);
		}		
		return true;
	}

	/* Check if provided user id is valid
	 * @param userIdDTO The user id in the user microservice of the user to be accessed
	 * @param callerName The name of the method being accessed
	 * @returns True if the user id is valid, false if not
	 * @throws An error if the user id is not valid
	 * @remark Intended to be used by other methods to check if the provided user id is valid
	 */
	protected checkIsValidId(userIdDTO: EntityIdDTO, callerName: string): boolean {
		if (!userIdDTO.value) {
			throw new Error(`${this.constructor.name}.${callerName} requires a valid user id, got: ${userIdDTO.value}`);
		}
		return true;
	}

	/* Find user by microservice id
	 * @param userId The user id in the user microservice
	 * @returns A promise that resolves to the user entity if found, or undefined if not found
	 * @throws An error if the user entity could not be fetched from the repository
	 * @remark Intended to be used by other methods to find a user entity by its user id in the user microservice
	 */
	protected async findUserByMicroserviceId(userId: EntityId): Promise<User[] | undefined> {
		// check if user exists and is unique in the repository
		const query = new Query<User, any>({
			searchCriteria: [
				{
					key: 'userId',
					operation: SearchFilterOperation.EQUALS,
					value: userId
				}
			]
		});

		const queryResult = await this.userRepo.fetchByQuery(query);
		if (queryResult.isFailure) {
			throw new PersistenceError(`Failed to fetch user entity: ${queryResult.error}`);
		}

		const users$ = queryResult.value as Observable<User[]>;
		const users = await firstValueFrom(users$.pipe(take(1)));

		return users;
	}

	/* Check if user exists in persistence layer
	 * @param userIdDTO The user id in the user microservice of the user to be accessed
	 * @param callerName The name of the method being accessed
	 * @returns True if the user exists, false if not
	 * @throws An error if the user entity does not exist
	 * @remark Intended to be used by other methods to check if the user entity exists in the persistence layer
	 */
	protected async getUniqueUser(userIdDTO: EntityIdDTO, callerName: string): Promise<User> {
		const users = await this.findUserByMicroserviceId(userIdDTO.value! as string);
		if (!users || users.length === 0) {
			throw new PersistenceError(`${this.constructor.name}.${callerName}: User entity with id ${userIdDTO.value} does not exist`);
		}
		else if (users.length > 1) {
			throw new PersistenceError(`${this.constructor.name}.${callerName}: User entity with id ${userIdDTO.value} is not unique`);
		}
		const user = users[0];
		return user;
	}
}