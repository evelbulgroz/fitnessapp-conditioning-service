import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { EntityId } from '@evelbulgroz/ddd-base';
import {  ManagedStatefulComponent, ManagedStatefulComponentMixin } from "../../libraries/managed-stateful-component";
import { Query, SearchFilterOperation } from '@evelbulgroz/query-fns';
import { StreamLoggableMixin } from '../../libraries/stream-loggable';

import PersistenceError from '../../shared/domain/persistence.error';
import UnauthorizedAccessError from '../../shared/domain/unauthorized-access.error';
import User from '../domain/user.entity';
import UserDTO from '../dtos/user.dto';
import UserRepository from '../repositories/user.repo';

/**
 * 
 * Processes {@link User} CRUD events received via requests from the User microservice.
 * 
 * @remark The user microservice holds all business data for the user, name, contact info, etc.
 * @remark The user entity in this microservice serves only to match a user's id in the user microservice to the ids of the logs the user has created here.
 * @remark This microservice acts as slave to the user microservice re. user management.
 * @remark Clients have no reason to request user retrieval from this microservice, only logs.
 * @remark Therefore, this service only needs to process create, delete and undelete events received from the user microservice.
 * @remark Depends on the User repository for caching and persistence of user entities.
 * @remark Defers to the {@link Usercontroller} for primary request data validation; only secondary validation (e.g. of business rules) is done here.
 * @remark It applies the {@link ManagedStatefulComponentMixin} mixin as it is a key component whose state needs to be managed.
 */
@Injectable()
export class UserDataService extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {}))  implements ManagedStatefulComponent {

	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	/**
	 * Constructor for the UserDataService class
	 * @param config The configuration service to use for retrieving configuration values
	 * @param userRepo The user repository to use for persisting and retrieving user entities
	 */
	constructor(
		protected readonly config: ConfigService,
		protected readonly userRepo: UserRepository
	) {
		super();
	}

	//------------------------------------- LIFECYCLE HOOKS -------------------------------------//

	// NOTE: Lifecycle hooks are not used in this class, as the service is a managed component
	
	//---------------------------------------- DATA API ---------------------------------------//
	
	/**
	 * Create a new user
	 * 
	 * @param requestingServiceName The user context for the user to be created
	 * @param userId The user id in the user microservice of the user to be created
	 * @param isAdmin Whether the caller is an admin user (default: false)
	 * 
	 * @returns A promise that resolves to the new (local) user id when the user has been created
	 * 
	 * @throws An error if the user id is not defined
	 * @throws An error if the user entity could not be created in the 
	 * 
	 * @remark Intended to be mostly triggered by a user create event received from the user microservice
	 * @remark Created user holds both entity unique to this microservice and the user id from the user microservice
	 * @remark Caller is expected to catch, handle and log any errors
	*/
	public async createUser(
		requestingServiceName: string,
		userId: EntityId,
		isAdmin: boolean = false
	): Promise<EntityId> {
		// do common checks
		await this.isReady();
		this.checkIsValidCaller(requestingServiceName, 'createUser', isAdmin);
		
		// check if user already exists in the repository
		const existingUser = await this.findUserByMicroserviceId(userId);
		if (existingUser !== undefined) {
			throw new PersistenceError(`User entity with id ${userId} already exists`);
		}
		
		// request valid -> create new user
		const dto: UserDTO = { className: 'User', userId: userId,	};
		const createResult = await this.userRepo.create(dto);
		if (createResult.isFailure) {
			throw new PersistenceError(`Failed to create user entity: ${createResult.error}`);
		}

		// creation successful -> return the new user id
		const user = createResult.value as User;
		return user.entityId!;
	}

	/**
	 * Delete a user
	 * 
	 * @param requestingServiceName The name of the service making the request
	 * @param userId The user id in the user microservice of the user to be deleted
	 * @param softDelete Whether to soft delete the user entity (default: true)
	 * @param isAdmin Whether the caller is an admin user (default: true)
	 * 
	 * @returns A promise that resolves when the user entity has been deleted
	 * 
	 * @throws An error if the user id is not defined
	 * @throws An error if the user entity could not be deleted in the repository
	 * 
	 * @remark Intended to be mostly triggered by a user delete event received from the user microservice
	 * @remark Caller is expected to catch, handle and log any errors
	 */
	public async deleteUser(
		requestingServiceName: string,
		userId: EntityId,
		softDelete: boolean = true,
		isAdmin: boolean = false
	): Promise<void> {
		// do common checks
		await this.isReady();
		this.checkIsValidCaller(requestingServiceName, 'delete', isAdmin);
		const user = await this.getUniqueUser(userId, 'delete');
		
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

	/**
	 * Undelete a user (if soft deleted)
	 * 
	 * @param requestingServiceName The user context for the user to be undeleted
	 * @param userId The user id in the user microservice of the user to be undeleted
	 * @param isAdmin Whether the caller is an admin user (default: false)
	 * 
	 * @returns A promise that resolves when the user entity has been undeleted
	 * 
	 * @throws An error if the user id is not defined
	 * @throws An error if the user entity could not be undeleted in the repository
	 * @throws An error if the user entity is not soft deleted
	 * 
	 * @remark Intended to be mostly triggered by a user undelete event received from the user microservice
	 * @remark Caller is expected to catch, handle and log any errors
	 */
	public async undeleteUser(
		requestingServiceName: string,
		userId: EntityId,
		isAdmin: boolean = false): Promise<void> {
		// do common checks
		await this.isReady();
		this.checkIsValidCaller(requestingServiceName, 'undeleteUser', isAdmin);
		const user = await this.getUniqueUser(userId, 'undeleteUser');
		
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

	/**
	 * Execute component initialization (called by ManagedStatefulComponentMixin)
	 *
	 * @returns Promise that resolves when the component is initialized
	 * @throws Error if initialization fails
	 * 
	 * @remark ManagedStatefulComponentMixin.initialize() caller already handles concurrency and updates state, so no need to replicate that here
	 * @remark For now basically a placeholder, as Repository handles all initialization
	 * 
	 * @todo Refactor to use cache library, when available
	 */
	public async onInitialize(): Promise<void> {
		try {
			this.logger.log(`Executing initialization...`, this.constructor.name);
			
			// Wait for the repository to be initialized
			// NOTE: This may triggger initialization if the repository is not already initialized
			await this.userRepo.isReady();			
			
			this.logger.log(`Initialization complete.`, this.constructor.name);
			return Promise.resolve();
		}
		catch (error) {
			this.logger.error(`Initialization failed:`, error instanceof Error ? error.message : String(error), this.constructor.name);
			return Promise.reject(error);
		}
	}

	/**
	 * Execute component shutdown (required by ManagedStatefulComponentMixin)
	 * 
	 * @returns Promise that resolves when the component is shut down
	 * @throws Error if shutdown fails
	 * 
	 * @remark Cleans up resources and unsubscribes from all subscriptions
	 * @remark Sets the state to SHUT_DOWN to indicate that the component is no longer active
	 * @remark ManagedStatefulComponentMixin.shutdown() caller already handles concurrency and updates state,
	 *   so no need to replicate that here
	 * 
	 * @todo Refactor to use cache library, when available
	 */
	public async onShutdown(): Promise<void> {		
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

	/*
	 * Check if caller is authorized to access a method
	 *
	 * @param requestingServiceName The name of the service making the request
	 * @param callingMethodName The name of the calling method
	 * @param isAdmin Whether the caller is an admin user (default: false)
	 * 
	 * @returns True if the caller is authorized, false if not	 * 
	 * @throws An error if the caller is not authorized to access the method
	 * 
	 * @remark Intended to be used by other methods to check if the caller is authorized to access the method
	 */
	protected checkIsValidCaller(requestingServiceName: string, callingMethodName: string, isAdmin: boolean = false): boolean {
		let userServiceName = this.config.get<any>('security.collaborators.user.serviceName');
		if (requestingServiceName !== userServiceName || !isAdmin) {
			throw new UnauthorizedAccessError(`User ${requestingServiceName} not authorized to access ${this.constructor.name}.${callingMethodName}`);
		}		
		return true;
	}

	/*
	 * Find user by microservice id
	 *
	 * @param userId The user id in the user microservice
	 
	* @returns A promise that resolves to the user entity if found, or undefined if not found
	 * @throws An error if the user entity could not be fetched from the repository
	 * 
	 * @remark Intended to be used by other methods to find a user entity by its user id in the user microservice
	 */
	protected async findUserByMicroserviceId(userId: EntityId): Promise<User | undefined> {
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

		if (!users || users.length === 0) { // no user found
			return undefined;
		}
		else if (users.length > 1) { // more than one user found
			// this should not happen, as userId should be unique in the user microservice
			throw new PersistenceError(`User entity with id ${userId} is not unique`);
		}

		return users[0]; // return the single user found
	}

	/*
	 * Check if user exists in persistence layer
	 *
	 * @param userId The user id in the user microservice of the user to be accessed
	 * @param callingMethodName The name of the method being accessed
	 * 
	 * @returns True if the user exists, false if not
	 * @throws An error if the user entity does not exist
	 * 
	 * @remark Intended to be used by other methods to check if the user entity exists in the persistence layer
	 */
	protected async getUniqueUser(userId: EntityId, callingMethodName: string): Promise<User> {
		const existingUser = await this.findUserByMicroserviceId(userId as string);
		if (existingUser === undefined) {
			throw new PersistenceError(`${this.constructor.name}.${callingMethodName}: User entity with id ${userId} does not exist`);
		}
		// findUserByMicroserviceId throws if user is not unique, so we can assume it is unique here
		return existingUser;
	}
}

export default UserDataService;