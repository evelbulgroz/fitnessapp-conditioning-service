import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { EntityId } from '@evelbulgroz/ddd-base';
import { Logger } from '@evelbulgroz/logger';
import { Query, SearchFilterOperation } from '@evelbulgroz/query-fns';

import EntityIdDTO from '../../shared/dtos/responses/entity-id.dto';
import ManagedStatefulComponentMixin from '../../app-health/mixins/managed-stateful-component.mixin';
import PersistenceError from '../../shared/domain/persistence.error';
import UnauthorizedAccessError from '../../shared/domain/unauthorized-access.error';
import User from '../domain/user.entity';
import UserContext from '../../shared/domain/user-context.model';
import UserDTO from '../dtos/user.dto';
import UserRepository from '../repositories/user.repo';

/** Processes User CRUD events received via requests from the User microservice.
 * @remark The user microservice holds all business data for the user, name, contact info, etc.
 * @remark The user entity in this microservice serves only to match a user's id in the user microservice to the ids of the logs the user has created here.
 * @remark This microservice acts as slave to the user microservice re. user management.
 * @remark Clients have no reason to request user retrieval from this microservice, only logs.
 * @remark Therefore, this service only needs to process create, delete and undelete events received from the user microservice.
 * @remark Depends on the User repository for caching and persistence of user entities.
 */
@Injectable()
export class UserService  extends ManagedStatefulComponentMixin(class {}) implements OnModuleDestroy {

	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		protected readonly config: ConfigService,
		protected readonly logger: Logger,
		protected readonly userRepo: UserRepository
	) {
		super();
	}

	//------------------------------------- LIFECYCLE HOOKS -------------------------------------//

	onModuleDestroy() {
		this.logger.log(`Shutting down...`, this.constructor.name);
		this.shutdown(); // call shutdown method from mixin
	}
	
	//---------------------------------------- DATA API ---------------------------------------//
	
	/** Create a new user
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
		const users = await this.findUserByMicroserviceId(userIdDTO.value!);
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

	/** Delete a user
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
		this.checkIsValidCaller(ctx, 'delete');
		this.checkIsValidId(userIdDTO, 'delete');
		const user = await this.getUniqueUser(userIdDTO, 'delete');
		
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

	/** Undelete a user (if soft deleted)
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
		this.checkIsValidCaller(ctx, 'undelete');
		this.checkIsValidId(userIdDTO, 'undelete');
		const user = await this.getUniqueUser(userIdDTO, 'undelete');
		
		// check if user is soft deleted 
		if (user.deletedOn === undefined) {
			return Promise.resolve(); // user is not soft deleted, return void
		}

		// undelete the user entity in the user repository
		const undeleteResult = await this.userRepo.undelete(user.entityId!);
		if (undeleteResult!.isFailure) {
			throw new PersistenceError(`Failed to undelete user entity: ${undeleteResult!.error}`);
		}

		// undeletion successful -> return void
		return Promise.resolve();
	}

	//------------------------------------- MANAGEMENT API --------------------------------------//
	
	/** @see ManagedStatefulComponentMixin for management API methods */

	/* Execute component initialization (required by ManagedStatefulComponentMixin)
	 * @returns Promise that resolves when the component is initialized
	 * @throws Error if initialization fails
	 * @remark ManagedStatefulComponentMixin.initialize() caller already handles concurrency and updates state, so no need to replicate that here
	 * @remark For now basically a placeholder, as Repository handles all initialization
	 * @todo Refactor to use cache library, when available
	 */
	public async onInitialize(): Promise<void> {
		try {
			this.logger.log(`Executing initialization...`, this.constructor.name);
			
			// initialize the cache with all conditioning logs and users from the respective repositories
			//this.cache = new BehaviorSubject<User[]>([]); // initialize cache observable
			//this.cache.next(await this.userRepo.fetchAll()); // populate cache with all users from user repo
			
			this.logger.log(`Initialization complete.`, this.constructor.name);
			return Promise.resolve();
		}
		catch (error) {
			this.logger.error(`Initialization failed:`, error instanceof Error ? error.message : String(error), this.constructor.name);
			return Promise.reject(error);
		}
	}

	/** Execute component shutdown (required by ManagedStatefulComponentMixin)
	 * @returns Promise that resolves when the component is shut down
	 * @throws Error if shutdown fails
	 * @remark Cleans up resources and unsubscribes from all subscriptions
	 * @remark Sets the state to SHUT_DOWN to indicate that the component is no longer active
	 * @todo ManagedStatefulComponentMixin.shutdown() caller already handles concurrency and updates state, so no need to replicate that here
	 * @todo Refactor to use cache library, when available
	 */
	public onShutdown(): Promise<void> {		
		try {
			this.logger.log(`Executing shutdown...`, this.constructor.name);
			
			// clean up resources
			this.subscriptions.forEach((subscription) => subscription?.unsubscribe()); // unsubscribe all subscriptions
			this.subscriptions = []; // clear subscriptions array
			//this.cache.complete(); // complete the cache observable to release resources
			//this.cache.next([]); // emit empty array to clear cache
			
			this.logger.log(`Shutdown execution complete.`, this.constructor.name);
			return Promise.resolve();
		} 
		catch (error) {
			this.logger.error(`Shutdown execution failed:`, error instanceof Error ? error.message : String(error), this.constructor.name);
			return Promise.reject(error);
		}
	}
	protected subscriptions: Subscription[] = []; // array of subscriptions to be cleaned up on shutdown
	
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

export default UserService;