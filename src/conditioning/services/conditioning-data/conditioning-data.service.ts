import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { BehaviorSubject, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { AggregatedTimeSeries, AggregationQuery, DataPoint } from '@evelbulgroz/time-series'
import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { EntityId, Result } from '@evelbulgroz/ddd-base';
import { LogLevel, StreamLoggable, StreamLoggableMixin } from '../../../libraries/stream-loggable';
import { ManagedStatefulComponent, ManagedStatefulComponentMixin } from '../../../libraries/managed-stateful-component';

import { Quantity } from '@evelbulgroz/quantity-class';
import { Query, SearchFilterCriterion } from '@evelbulgroz/query-fns';

import AggregationQueryDTO from '../../dtos/aggregation-query.dto';
import AggregatorService from '../aggregator/aggregator.service';
import ComponentStateInfo from '../../../libraries/managed-stateful-component/models/component-state-info.model';
import { ConditioningData } from '../../domain/conditioning-data.model';
import ConditioningLog from '../../domain/conditioning-log.entity';
import ConditioningLogDTO from '../../dtos/conditioning-log.dto';
import ConditioningLogRepository from '../../repositories/conditioning-log.repo';
import ConditioningLogSeries from '../../domain/conditioning-log-series.model';
import DomainEventHandler from '../../../shared/handlers/domain-event.handler';
import EventDispatcherService from '../../../shared/services/utils/event-dispatcher/event-dispatcher.service';
import NotFoundError from '../../../shared/domain/not-found.error';
import PersistenceError from '../../../shared/domain/persistence.error';
import QueryDTO from '../../../shared/dtos/responses/query.dto';
import QueryMapper from '../../mappers/query.mapper';
import UnauthorizedAccessError from '../../../shared/domain/unauthorized-access.error';
import User from '../../../user/domain/user.entity';
import UserPersistenceDTO from '../../../user/dtos/user-persistence.dto';
import UserRepository from '../../../user/repositories/user.repo';

/**
 * Helper function to default sort logs ascending by start date and time
 */
function compareLogsByStartDate(a: ConditioningLog<any, ConditioningLogDTO>, b: ConditioningLog<any, ConditioningLogDTO>): number {
	return (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0);
}

/**
 * Represents a query for conditioning logs (typing shorthand)
 */
export type QueryType = Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>;

/**
 * Specifies the properties of a user logs cache entry
 */
export interface UserLogsCacheEntry {
	userId: EntityId;
	logs: ConditioningLog<any, ConditioningLogDTO>[];
	lastAccessed?: Date;
}

/**
 * Provides access to data from conditioning training sessions, as intermediary between controller and repositories.
 * 
 * @remark Handles enforcement of business rules, aggregation and other data processing unrelated to either persistence or request data sanitization.
 * @remark Uses a local cache to store logs by user id, to avoid repeated fetches from the persistence layer.
 * @remark Relies on repositories for persistence, and on controller(s) for request authentication, user context, data sanitization, and error logging.
 * @remark For now, Observable chain ends here with methods that return single-shot promises, since there are currently no streaming endpoints in the API.
 * @remark Admins can access all logs, other users can only access their own logs.
 * @remark Local cache is kept in sync with repository data via subscriptions to log and user repo events.
 * @remark Provides {@link StreamLoggable} API via {@link StreamLoggableMixin}, compatible with streaming Logger service.
 * @remark It applies the {@link ManagedStatefulComponentMixin} mixin as it is a key component whose state needs to be managed.
 *
 * @todo Use Query instance instead of QueryDTO in methods taking query param, to reduce coupling and improve testability: now).
 * @todo Consider breaking up into separate, smaller service classes to make this class more manageable and testable by simply providing a facade to the new sub-services (later).
 * @todo Use shared cache library when available (later).
 */
@Injectable()
export class ConditioningDataService extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements ManagedStatefulComponent {
	
	//----------------------------------- PROPERTIES ------------------------------------//
	
	 // Local cache of logs by user id in user microservice
	protected readonly cache = new BehaviorSubject<UserLogsCacheEntry[]>([]);
	
	// Inject separately to keep constructor signature clean
	@Inject(QueryMapper) protected readonly queryMapper: QueryMapper<QueryType, QueryDTO>;

	 // Array of subscriptions to be cleaned up on shutdown
	protected readonly subscriptions: Subscription[] = [];
	
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	/**
	 * Constructor for ConditioningDataService
	 * 
	 * @param aggregator Aggregator service for aggregating time series data
	 * @param eventDispatcher Event dispatcher service for dispatching domain events
	 * @param logRepo Conditioning log repository for persisting and retrieving logs
	 * @param userRepo User repository for persisting and retrieving users
	 */
	public constructor(
		protected readonly aggregator: AggregatorService,
		@Inject(forwardRef(() => EventDispatcherService)) // forwardRef to handle circular dependency
		protected readonly eventDispatcher: EventDispatcherService,
		protected readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		protected readonly userRepo: UserRepository
	) {
		super();
		//this.subscribeToRepoEvents(); // deps not intialized in onModuleInit, so subscribe here
	}

	//------------------------------------- LIFECYCLE HOOKS -------------------------------------//

	// NOTE: Lifecycle hooks are not used in this class, as the service is a managed component
	
	//---------------------------------------- DATA API -----------------------------------------//

	/**
	 * New API: Create a new conditioning log for a user in the system
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @param targetUserId Entity id of the user for whom to create the log, used for logging and authorization check
	 * @param logtoCreate Conditioning log to create, with properties to set in the new log
	 * @returns Entity id of the created log
	 * @throws UnauthorizedAccessError if user is not authorized to create log
	 * @throws NotFoundError if user does not exist in persistence
	 * @throws PersistenceError if error occurs while creating log or updating user in persistence
	 * @logs Error if error occurs while rolling back log creation 
	 * 
	 * @remark Logs and users are created/updated in the persistence layer, and propagated to cache via subscription to user repo updates
	 * @remark Admins can create logs for any user, other users can only create logs for themselves
	 */
	public async createLog(
		requestingUserId: EntityId,
		targetUserId: EntityId,
		logtoCreate: ConditioningLog<any, ConditioningLogDTO>,
		isAdmin: boolean = false,
	): Promise<EntityId> {
		// initialize service if necessary
		await this.isReady();

		// check if user is authorized to create log
		if (!isAdmin) { // admin has access to all logs, authorization check not needed
			if (targetUserId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to create log for user ${targetUserId}.`);
			}
		}

		// check if user exists in persistence layer
		const userResult = await this.userRepo.fetchById(targetUserId);
		if (userResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: User ${targetUserId} not found.`);
		}

		// create log in persistence layer
		const result = await this.logRepo.create(logtoCreate);
		if (result.isFailure) { // creation failed -> throw persistence error
			throw new PersistenceError(`${this.constructor.name}: Error creating conditioning log: ${result.error}`);
		}
		const newLog = result.value as ConditioningLog<any, ConditioningLogDTO>;

		// add log to user in persistence layer, roll back log creation if user update fails
		const user = await firstValueFrom(userResult.value as Observable<User>);
		user.addLog(newLog.entityId!);
		const userUpdateResult = await this.userRepo.update(user.toDTO());
		if (userUpdateResult.isFailure) { // user update failed -> roll back log creation, then throw persistence error
			try {
				this.rollbackLogCreation(newLog.entityId!); // deleting orphaned log from log repo, retry if necessary
			}
			catch (error) {
				console.error('Error rolling back log creation: ', error);
			}
			throw new PersistenceError(`${this.constructor.name}: Error updating user ${targetUserId}: ${userUpdateResult.error}`);
		}

		// NOTE: cache is updated via subscription to user repo updates, no need to update cache here

		// log created successfully -> return entity id
		return Promise.resolve(newLog.entityId!);
		
	}
	
	/**
	 * New API: Get list of the number of times each conditioning activity has been logged for a single user, or all users (admin only)
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Optional entity id of the user for whom to count logs, used for logging and authorization check (if not provided, counts for all users)
	 * @param queryDTO Optional query to filter logs (else all accessible logs are counted)
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @param includeDeleted Optional flag to include soft deleted logs in the response (default is false)
	 * @returns Record of activity types and the number of times each has been logged
	 * @throws UnauthorizedAccessError if user is not authorized to access logs
	 * 
	 * @remark Admins can access logs for all users, other users can only access their own logs
	 */
	public async fetchActivityCounts(
		requestingUserId: EntityId,
		targetUserId?: EntityId,
		queryDTO?: QueryDTO,
		isAdmin: boolean = false,		
		includeDeleted: boolean = false
	): Promise<Record<string, number>> {
		await this.isReady(); // initialize service if necessary

		// check if user is authorized to access log(s)
		if (!isAdmin) { // admin has access to all logs, authorization check not needed
			if(!targetUserId) { // user id not provided -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to access logs for all users.`);
			}
			else if (targetUserId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to access logs for user ${targetUserId}.`);
			}
		}

		// get accessible logs given user id and role
		let accessibleLogs: ConditioningLog<any, ConditioningLogDTO>[];
		if (targetUserId) { // user id provided -> get logs for single user
			const userResult = await this.userRepo.fetchById(targetUserId);
			if (userResult.isFailure) { // fetch failed -> throw not found error
				throw new NotFoundError(`${this.constructor.name}: User ${targetUserId} not found.`);
			}
			else {// user exists -> get logs for single user
				accessibleLogs = this.cache.value.find((entry) => entry.userId === targetUserId)?.logs ?? [];
			}
		}
		else { // user id not provided -> get all logs for admin user
			accessibleLogs = this.cache.value.flatMap((entry) => entry.logs) ?? [];
		}

		// filter logs by query, if provided, else use all accessible logs
		let query: QueryType | undefined;
		if (queryDTO) { // map query DTO, if provided, to library query for processing logs
			queryDTO.userId = undefined; // logs don't have a user id field, so remove it from query
			query = this.queryMapper.toDomain(queryDTO); // mapper excludes dto props that are undefined
		}
		let matchingLogs = query ? query.execute(accessibleLogs) : accessibleLogs;

		// filter out soft deleted logs, unless expressly requested
		matchingLogs = matchingLogs.filter((log) => !!includeDeleted || !log.deletedOn );

		// count activity types in matching logs (using interim Map for efficiency when aggregating large datasets)
		const activityCounts = new Map<ActivityType, number>();
		matchingLogs.forEach((log) => {
			const count = activityCounts.get(log.activity) ?? 0;
			activityCounts.set(log.activity, count + 1);
		});

		// serialize Map to plain object for serving as JSON (Map is not serializable by default)
		const activityCountsObj: Record<string, number> = {};
			activityCounts.forEach((value, key) => {
			activityCountsObj[key] = value;
		});

		return Promise.resolve(activityCountsObj);
	} 

	/**
	 * New API: Get aggregated time series of conditioning logs
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Entity id of the user for whom to aggregate logs, used for logging and authorization check
	 * @param aggregationQuery Validated aggregation query speficifying aggregation parameters
	 * @param query Optional query to select logs to aggregate (else all accessible logs are aggregated)
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @param includeDeleted Optional flag to include soft deleted logs in the response (default is false)
	 * @returns Aggregated time series of conditioning logs
	 * @throws UnauthorizedAccessError if user attempts unauthorized access to logs
	 * 
	 * @remark If provided, QueryDTO should not include deletedOn field, to not interfere with soft deletion handling
	 */
	public async fetchAggretagedLogs(
		aggregationQuery: AggregationQuery,
		requestingUserId: EntityId,
		targetUserId?: EntityId,
		query?: QueryType,
		isAdmin: boolean = false,
		includeDeleted: boolean = false
	): Promise<AggregatedTimeSeries<ConditioningLog<any, ConditioningLogDTO>, any>> {
		await this.isReady(); // initialize service if necessary

		// check if user is authorized to access log(s)
		void this.checkUserAuthorization(requestingUserId, targetUserId, isAdmin); // throw UnauthorizedAccessError if user is not authorized
		
		// constrain searchable logs to those of single user unless user is admin
		const accessibleLogs: ConditioningLog<any, ConditioningLogDTO>[] = this.getAccessibleLogs(requestingUserId, targetUserId, query, isAdmin);

		// filter logs by query, if provided, else use all accessible logs
		let matchingLogs = query ? query.execute(accessibleLogs) : accessibleLogs;

		// filter out soft deleted logs, if not included
		matchingLogs = matchingLogs.filter((log) => includeDeleted || !log.deletedOn );

		// convert searchable logs matching query to time series
		const timeSeries = this.toConditioningLogSeries(matchingLogs);

		// aggregate time series
		const aggregatedSeries = this.aggregator.aggregate(
			timeSeries,
			aggregationQuery,
			(dataPoint: DataPoint<any>) => { // value extractor for Quantity values
				const propValue = dataPoint.value[aggregationQuery.aggregatedProperty as keyof ConditioningLog<any, ConditioningLogDTO>];
				if (propValue instanceof Quantity) {
					return propValue.to(aggregationQuery.aggregatedValueUnit ?? '').scalar;
				}
				else {
					return propValue
				}
			}
		);
		return Promise.resolve(aggregatedSeries);		
	}	

	/**
	 * New API: Get single, detailed conditioning log by log entity id
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Entity id of the user for whom to retrieve the log, used for logging and authorization check
	 * @param logId Entity id of the conditioning log to retrieve
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @param includeDeleted Optional flag to include soft deleted logs in the response (default is false)
	 * @returns Detailed log matching the entity id, if found and authorized
	 * @throws UnauthorizedAccessError if user is not authorized to access log
	 * @throws NotFoundError if log is not initialized in cache or not found in persistence
	 * @throws PersistenceError if error occurs while fetching log from persistence
	 * 
	 * @remark Replaces overview log in cache with detailed log from persistence on demand, and updates cache subscribers
	 */
	public async fetchLog(
		requestingUserId: EntityId,
		targetUserId: EntityId,
		logId: EntityId,
		isAdmin: boolean = false,
		includeDeleted: boolean = false
	): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		return new Promise(async (resolve, reject) => {
			await this.isReady(); // initialize service if necessary

			// check if user is authorized to access log
			if (!isAdmin) { // admin has access to all logs, authorization check not needed
				if (targetUserId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
					reject(new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to access log for user ${targetUserId}.`));
					return;
				}
			}
			
			// check if log exists in cache
			const entryWithLog = this.cache.value.find((entry) => entry.logs.some((log) => log.entityId === logId));
			if (!entryWithLog) { // log not found in cache, cannot assess authorization -> throw NotFoundError
				reject(new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found or access denied.`));
				return;
			}

			// check if log is soft deleted, optionally include deleted logs
			const log = entryWithLog.logs.find((log) => log.entityId === logId);
			if (log!.deletedOn && !includeDeleted) { // log is soft deleted and not included -> throw NotFoundError
				reject(new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found or access denied.`));
				return;
			}
				
			// log exists, check if user is authorized to access it
			if (!isAdmin) { // admin has access to all logs, authorization check not needed
				const logOwnwerId = entryWithLog.userId;
				if (logOwnwerId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
					reject(new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to access log ${logId} for user ${logOwnwerId}.`));
					return;
				}
			}
			
			// check if log is already detailed, else fetch full log from persistence
			const index = entryWithLog.logs.findIndex((log) => log.entityId === logId);
			const originalLog = entryWithLog.logs[index];
			let detailedLog: ConditioningLog<any, ConditioningLogDTO> | undefined;
			if (!originalLog.isOverview) { // log is already detailed -> resolve as-is and exit				
				resolve(originalLog);
				return;
			}
			else { // log is not detailed -> fetch full log from persistence, replace in cache, and resolve
				const result = await this.logRepo.fetchById(logId!);
				if (result.isFailure) { // retrieval failed -> throw persistence error
					reject(new PersistenceError(`${this.constructor.name}: Error retrieving conditioning log ${logId} from persistence layer: ${result.error}`));
					return;
				}
				const detailedLog$ = result.value as Observable<ConditioningLog<any, ConditioningLogDTO>>;
				detailedLog = await firstValueFrom(detailedLog$.pipe(take(1)));
				if (detailedLog !== undefined) { // detailed log available					
					entryWithLog.logs[index] = detailedLog; // replace original log in cache
					entryWithLog.lastAccessed = new Date(); // update last accessed timestamp
					this.cache.next([...this.cache.value]); // update cache with shallow copy to trigger subscribers
					resolve(detailedLog);
					return;
				}
				else { // detailed log not found -> throw NotFoundError
					reject(new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found in persistence layer.`));
					return;
				}		
			}
		});
	}

	/**
	 * New API: Get all conditioning logs for user and matching query (if provided)
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Optional entity id of the user for whom to retrieve logs, used for logging and authorization check (if not provided, logs for requesting user are returned)
	 * @param queryDTO Optional query to filter logs (else all accessible logs for role are returned)
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @param includeDeleted Optional flag to include soft deleted logs in the response, default is false
	 * @returns Array of conditioning logs (constrained by user context and query)
	 * @throws UnauthorizedAccessError if user attempts authorized access to logs
	 * 
	 * @remark Overview logs are guaranteed to be available
	 * @remark Full logs are loaded into cache from persistence on demand using conditioningLogDetails(), and may be replaced in cache with overview logs to save memory
	 * @remark If provided, QueryDTO should not include deletedOn field, to not interfere with soft deletion handling
	 */
	public async fetchLogs(
		requestingUserId: EntityId,
		targetUserId?: EntityId,
		query?: QueryType,
		isAdmin: boolean = false,
		includeDeleted: boolean = false
	): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		await this.isReady(); // initialize service if necessary
		
		// check if user is authorized to access log(s)
		void this.checkUserAuthorization(requestingUserId, targetUserId, isAdmin); // throw UnauthorizedAccessError if user is not authorized
		
		// constrain searchable logs to those of single user unless user is admin
		const accessibleLogs: ConditioningLog<any, ConditioningLogDTO>[] = this.getAccessibleLogs(requestingUserId, targetUserId, query, isAdmin);

		// filter logs by query, if provided, else use all accessible logs
		let matchingLogs = query ? query.execute(accessibleLogs) : accessibleLogs;
		
		// filter out soft deleted logs, if not included
		matchingLogs = matchingLogs.filter((log) => includeDeleted || !log.deletedOn );
		
		// sort logs ascending by start date and time, if no sort criteria provided
		let sortedLogs = matchingLogs;
		if (!query?.sortCriteria || query.sortCriteria.length === 0) {// default sort is ascending by start date and time
			sortedLogs = matchingLogs.sort(compareLogsByStartDate);
		}
		
		return Promise.resolve(sortedLogs);
	}

	/**
	 * New API: Update an existing conditioning log for a user
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Entity id of the user for whom to update the log, used for logging and authorization check
	 * @param logId Entity id of the conditioning log to update
	 * @param log Partial conditioning log with updated properties
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @returns void
	 * @throws UnauthorizedAccessError if user is not authorized to update log
	 * @throws NotFoundError if log is not found in persistence while excluding soft deleted logs
	 * @throws PersistenceError if error occurs while updating log in persistence
	 * 
	 * @remark Logs are updated in the persistence layer, and propagated to cache via subscription to user repo updates
	 * @remark Admins can update logs for any user, other users can only update logs for themselves
	 * @remark Log entity id must be set in the DTO, else the update will fail
	 * @remark Does not support direct update of soft deleted logs, undelete first if necessary
	 */
	public async updateLog(
		requestingUserId: EntityId,
		targetUserId: EntityId,
		logId: EntityId,
		log: Partial<ConditioningLog<any, ConditioningLogDTO>>,
		isAdmin: boolean = false
	): Promise<void> {
		await this.isReady(); // initialize service if necessary

		// check if user is authorized to update log
		if (!isAdmin) { // admin has access to all logs, authorization check not needed
			if (targetUserId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to update log for user ${targetUserId}.`);
			}
		}

		// check if log exists in repo, else throw NotFoundError
		const logResult = await this.logRepo.fetchById(logId!);
		if (logResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found.`);
		}

		// update log in persistence layer
		const logDTO = (log as ConditioningLog<any, ConditioningLogDTO>).toPersistenceDTO(); // convert log to DTO for persistence
		logDTO.entityId = logId; // ensure entity id is set to target log in DTO
		const logUpdateResult = await this.logRepo.update(logDTO);
		if (logUpdateResult.isFailure) { // update failed -> throw persistence error
			throw new PersistenceError(`${this.constructor.name}: Error updating conditioning log ${logId}: ${logUpdateResult.error}`);
		}

		// NOTE: cache is updated via subscription to user repo updates, no need to update cache here

		// succcess -> resolve with void
		return Promise.resolve();		
	}

	/**
	 * New API: Delete a conditioning log by entity id
	 * 
	 * @param requestingUserId User context for the request (includes user id and roles)
	 * @param logId Entity id of the conditioning log to delete, wrapped in a DTO
	 * @returns void
	 * @throws UnauthorizedAccessError if user is not authorized to delete log
	 * @throws NotFoundError if either log or user is not found in persistence
	 * @throws PersistenceError if error occurs while deleting log or updating user in persistence
	 * 
	 * @remark Logs are deleted from the persistence layer, and propagated to cache via subscription to user repo updates
	 * @remark Admins can delete logs for any user, other users can only delete logs for themselves
	 */
	public async deleteLog(
		requestingUserId: EntityId,
		targetUserId: EntityId,
		logId: EntityId,
		softDelete: boolean = true,
		isAdmin: boolean = false
	): Promise<void> {
		// initialize service if necessary
		await this.isReady();

		// check if user is authorized to delete log
		if (!isAdmin) { // admin has access to all logs, authorization check not needed
			if (targetUserId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to create log for user ${targetUserId}.`);
			}
		}

		// check if log exists in persistence layer
		const logResult = await this.logRepo.fetchById(logId!);
		if (logResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found.`);
		}

		// check if user exists in persistence layer
		const userResult = await this.userRepo.fetchById(targetUserId);
		if (userResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: User ${targetUserId} not found.`);
		}
		
		// update user in persistence layer:
		// rolling back log deletion is harder than rolling back user update, so update user first
		const user = await firstValueFrom(userResult.value as Observable<User>);
		const originalUserPersistenceDTO = user.toPersistenceDTO(); // save original user state for potential rollback
		if (!softDelete) { // hard delete -> remove log from user (user entity has no concept of soft delete, so leave as is when soft deleting)
			user.removeLog(logId); // remove log
			const userUpdateResult = await this.userRepo.update(user.toPersistenceDTO());
			if (userUpdateResult.isFailure) { // update failed -> throw persistence error
				throw new PersistenceError(`${this.constructor.name}: Error updating user ${targetUserId}: ${userUpdateResult.error}`);
			}
		}

		// (soft) delete log in persistence layer
		const logDeleteResult = await this.logRepo.delete(logId, softDelete);
		if (logDeleteResult.isFailure) { // deletion failed -> roll back user update, then throw persistence error
			if(!softDelete) { // hard delete -> roll back user update
				this.rollBackUserUpdate(originalUserPersistenceDTO);
			}
			throw new PersistenceError(`${this.constructor.name}: Error deleting conditioning log ${logId}: ${logDeleteResult.error}`);
		}

		// NOTE: cache is updated via subscription to user repo updates, no need to update cache here
		
		// log deleted successfully -> return undefined
		return Promise.resolve();
	}

	/**
	 * New API: Undelete a conditioning log by entity id (soft delete only)
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Entity id of the user for whom to undelete the log
	 * @param logId Entity id of the conditioning log to undelete
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * @returns void
	 * @throws UnauthorizedAccessError if user is not authorized to undelete log
	 * @throws NotFoundError if log is not found in persistence
	 * @throws PersistenceError if error occurs while undeleting log in persistence
	 * 
	 * @remark Logs are undeleted in the persistence layer, and propagated to cache via subscription to user repo updates
	 * @remark Admins can undelete logs for any user, other users can only undelete logs for themselves
	 * @remark Does not support direct undelete of hard deleted logs, use createLog() instead
	 */
	public async undeleteLog(
		requestingUserId: EntityId,
		targetUserId: EntityId,
		logId: EntityId,
		isAdmin: boolean = false
	): Promise<void> {
		// initialize service if necessary
		await this.isReady();

		// check if user is authorized to undelete log
		if (!isAdmin) { // admin has access to all logs, authorization check not needed
			if (targetUserId !== requestingUserId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to undelete log for user ${targetUserId}.`);
			}
		}

		// check if log exists in persistence layer
		const logFetchResult = await this.logRepo.fetchById(logId);
		if (logFetchResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found.`);
		}

		// undelete log in persistence layer
		const logUndeleteResult = await this.logRepo.undelete(logId) as Result<undefined>;
		if (logUndeleteResult.isFailure) { // undelete failed -> throw persistence error
			throw new PersistenceError(`${this.constructor.name}: Error undeleting conditioning log ${logId}: ${logUndeleteResult.error}`);
		}

		// NOTE: cache is updated via subscription to log repo updates, no need to update cache here

		// log undeleted successfully -> return undefined
		return Promise.resolve();
	}

	/**
	 * Get user logs cache for domain event handlers
	 * 
	 * @param caller Domain event handler requesting access to user logs cache
	 * @returns Array of user logs cache entries (shallow copy of cache)
	 * @throws UnauthorizedAccessError if caller is not a domain event handler
	 * 
	 * @remark Used by domain event handlers to access user logs cache
	 */
	public getCacheSnapshot(caller: DomainEventHandler<any>): UserLogsCacheEntry[] {
		if (!(caller instanceof DomainEventHandler)) {
			throw new UnauthorizedAccessError('Unauthorized access: only domain event handlers can access user logs cache.');
		}
		return [...this.cache.value];
	}

	/**
	 * Update user logs cache for domain event handlers
	 * 
	 * @param newCache New cache to replace existing cache
	 * @param caller Domain event handler updating user logs cache
	 * @returns void
	 * @throws UnauthorizedAccessError if caller is not a domain event handler
	 * 
	 * @remark Used by domain event handlers to update user logs cache
	 */
	public updateCache(newCache: UserLogsCacheEntry[], caller: DomainEventHandler<any>): void {
		if (!(caller instanceof DomainEventHandler)) {
			throw new UnauthorizedAccessError('Unauthorized access: only domain event handlers can update user logs cache.');
		}
		this.cache.next(newCache);
	}
	
	/**
	 * In production: Get aggregated conditioning data with series from all activities
	  */
	public async conditioningData(userId?: EntityId): Promise<ConditioningData> {	
		await this.isReady(); // lazy load logs if necessary
		let logs: ConditioningLog<any, ConditioningLogDTO>[];
		if (userId !== undefined) {
			const cacheEntry = this.cache.value.find((entry) => entry.userId === userId);
			logs = cacheEntry?.logs ?? [];
		}
		else {
			logs = this.cache.value.flatMap((entry) => entry.logs);
		}

		const dataseries = logs
			.sort(compareLogsByStartDate) // sort logs ascending by start date and time
			.map((log) => log.activity) // get unique activities
			.reduce((unique, item) => unique.includes(item as unknown as never) ? unique : [...unique, item], [])
			.map((activity) => logs.filter((log) => log.activity === activity)) // group logs for each activity
			.map((logs) => this.toConditioningLogSeries(logs)) // convert grouped logs to time series
			.map((series) => { // map to array of ConditioningDataSeries
				const activityMap = new Map<ActivityType, number>([ // map activity to id used by Suunto import and expected by front end
					[ActivityType.MTB, 1],
					[ActivityType.RUN, 2],
					[ActivityType.SWIM, 3],
					[ActivityType.BIKE, 4],
					[ActivityType.SKI, 5],
					[ActivityType.OTHER, 6]
				]);

				const firstLog = series.data[0].value as ConditioningLog<any, ConditioningLogDTO>;
				const data = { // map to ConditioningDataSeries
					activityId: activityMap.get(firstLog.activity) ?? 0,
					start: firstLog.start,
					label: firstLog.activity,
					unit: 'hours',
					data: series.data.map((dataPoint: any) => {
						return {
							timeStamp: dataPoint.timeStamp,
							value: (dataPoint.value as ConditioningLog<any, ConditioningLogDTO>).duration?.to('hours').scalar
						}
					})
				};
				return data;
			});
		
		return Promise.resolve({ dataseries } as unknown as ConditioningData);
	}

	//------------------------------------- MANAGEMENT API --------------------------------------//
	
	/** @see ManagedStatefulComponentMixin for management API methods */
	
	/**
	 * Execute component specific initialization (called by {@link ManagedStatefulComponentMixin})
	 * 
	 * @returns Promise that resolves when the component is initialized
	 * @throws Error if initialization fails
	 * 
	 * @remark Initializes the cache with all conditioning logs and users from the respective repositories
	 * @remark Cache is initialized lazily on first access to avoid unnecessary overhead
	 * @remark Cache is populated with all logs from conditioning log repo and all users from user repo
	 * @remark ManagedStatefulComponentMixin.initialize() caller already handles concurrency and updates state,
	 *   so no need to replicate that here
	 * @remark Not really intended as a public API, but {@link ManagedStatefulComponentMixin} requires it to be public:
	 *  use initialize() instead for public API
	 * 
	 * @todo Refactor to use cache library, when available
	 */
	public override async onInitialize(): Promise<void> {
		// if cache is already populated, return immediately
		if (this.cache.value.length > 0) {
			return Promise.resolve();
		}

		// execute initialization
		try {
			this.logger.info('Executing initialization...');

			// Wait for both repos to be ready to ensure they are initialized before fetching data
			// NOTE: This may trigger initialization if the repos are not already initialized
			await Promise.all([this.logRepo.isReady(), this.userRepo.isReady()]);
			
			// fetch all logs from conditioning log repo
			let allLogs: ConditioningLog<any, ConditioningLogDTO>[] = [];
			const logsResult = await this.logRepo.fetchAll();
			if (logsResult.isSuccess) {
				const allLogs$ = logsResult.value as Observable<ConditioningLog<any, ConditioningLogDTO>[]>;
				allLogs = await firstValueFrom(allLogs$.pipe(take(1)));
				allLogs.sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0)); // sort logs ascending by start date and time, if available
			}
			else {
				throw new Error(`Error initializing conditioning logs: ${logsResult.error}`);
			}
			
			// fetch all users from user repo
			let users: User[] = [];
			const usersResult = await this.userRepo.fetchAll();
			if (usersResult.isSuccess) {
				const users$ = usersResult.value as Observable<User[]>;
				users = await firstValueFrom(users$.pipe(take(1)));
			}
			else {
				throw new Error(`Error initializing user logs: ${usersResult.error}`);
			}

			// combine logs and users into user logs cache entries
			const now = new Date();
			const userLogs: UserLogsCacheEntry[] = users.map((user: User) => {
				const logs = allLogs.filter((log) => user.logs.includes(log.entityId!));
				return { userId: user.userId!, logs: logs, lastAccessed: now };
			});
			this.cache.next(userLogs);

			// subscribe to user and log repo events
			this.subscribeToRepoEvents();
			
			this.logger.info(`Initialization execution complete: Cached ${allLogs.length} logs for ${users.length} users.`);
			return Promise.resolve();
		}
		catch (error) {
			this.logger.error(`Cache initialization failed:`, error instanceof Error ? error.message : String(error));
			return Promise.reject(error);
		}
	}
	
	/**
	 * Execute component shutdown (called by ManagedStatefulComponentMixin)
	 * 
	 * @returns Promise that resolves when the component is shut down
	 * @throws Error if shutdown fails
	 * 
	 * @remark Cleans up resources and unsubscribes from all subscriptions
	 * @remark Completes the cache observable to release resources
	 * @remark Unsubscribes from all subscriptions to avoid memory leaks
	 * @remark Sets the state to SHUT_DOWN to indicate that the component is no longer active
	 * @remark ManagedStatefulComponentMixin.shutdown() caller already handles concurrency and updates state, so no need to replicate that here
	 * @remark Not really intended as a public API, but {@link ManagedStatefulComponentMixin} requires it to be public:
	 * use shutdown() instead for public API
	 * @todo Refactor to use cache library, when available
	 */
	public override onShutdown(): Promise<void> {		
		try {
			this.logger.info(`Executing shutdown...`);
			
			// clean up resources
			while (this.subscriptions.length > 0) { // unsubscribe all subscriptions
				const subscription = this.subscriptions.shift(); // remove in FIFO order
				if (subscription) {
					subscription.unsubscribe();
				}
			}
			
			this.cache.complete(); // complete the cache observable to release resources
			this.cache.next([]); // emit empty array to clear cache
			
			this.logger.info('Shutdown execution complete.');
			return Promise.resolve();
		} 
		catch (error) {
			this.logger.error(`Shutdown execution failed:`, error instanceof Error ? error.message : String(error));
			return Promise.reject(error);
		}
	}
	
	//------------------------------------ PROTECTED METHODS ------------------------------------//

	/*
	 * Helper method to authorize user access to logs
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Entity id of the user for whom to authorize access, used for logging and authorization check
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * 
	 * @returns void
	 * 
	 * @throws UnauthorizedAccessError if user is not authorized to access logs
	 */
	protected checkUserAuthorization(requestingUserId: EntityId, targetUserId?: EntityId, isAdmin: boolean = false): void {
		if (!isAdmin) { // admin has access to all logs, authorization check not needed
			if (targetUserId !== requestingUserId) { // user id does not match -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to access logs for user ${targetUserId}.`);
			}
		}
	}

	/*
	 * Helper method to get accessible logs for a user, based on their role and optional query
	 * 
	 * @param requestingUserId Entity id of the user making the request, used for logging and authorization check
	 * @param targetUserId Entity id of the user for whom to retrieve logs, used for logging and authorization check
	 * @param query Optional query to filter logs (else all accessible logs are returned)
	 * @param isAdmin Whether the requesting user is an admin, used for authorization check (default is false)
	 * 
	 * @returns Array of accessible logs for the user, constrained by their role and query
	 * 
	 * @throws UnauthorizedAccessError if user attempts unauthorized access to logs
	 */
	protected getAccessibleLogs(requestingUserId: EntityId, targetUserId?: EntityId, query?: QueryType, isAdmin: boolean = false) {
		let accessibleLogs: ConditioningLog<any, ConditioningLogDTO>[];
		if (!isAdmin) { // if the user isn't an admin, prevent access to other users' logs
			if (query !== undefined) { // if query is provided, check if it contains userId criteria
				const userIdCriteria = this.getSearchCriteriaByKey('userId', query);
				userIdCriteria?.forEach((criterion: SearchFilterCriterion<any, any>) => {
					if (criterion.value && criterion.value !== requestingUserId) {
						throw new UnauthorizedAccessError(`${this.constructor.name}: User ${requestingUserId} tried to access logs for user ${criterion.value}.`);
					}
				});
			}
			accessibleLogs = this.cache.value.find((entry) => entry.userId === targetUserId)?.logs ?? [];
		}
		else { // if the user is an admin, they can access all logs
			accessibleLogs = this.cache.value.flatMap((entry) => entry.logs);
		}
		return accessibleLogs;
	}
	
	/* Get search criteria by key from query
	 * @param key Key to search for in the query's search criteria
	 * @param query Query to search in
	 * @return Array of search criteria matching the key, or undefined if not found
	 * @remark Used to extract specific search criteria from the query for further processing
	 * @todo Move this to query-fns library, as a method of Query
	 */
	protected getSearchCriteriaByKey(key: string, query: QueryType): SearchFilterCriterion<any, any>[] | undefined {
		const matches = query.searchCriteria?.filter((criterion: SearchFilterCriterion<any,any>) => criterion.key === key);
		return (matches && matches.length > 0) ? matches as SearchFilterCriterion<any, any>[]: undefined;
	}

	/*
	 * Purge log from log repo that has been orphaned by failed user update (log creation helper)
	 *
	 * @param logId Entity id of the log to purge from the log repo
	 * @param softDelete Flag to indicate whether to soft delete the log (default: false since log is orphaned by other CRUD error)
	 * @param retries Number of retries before giving up
	 * @param delay Delay in milliseconds between retries
	 */ 
	protected async rollbackLogCreation(logId: EntityId, softDelete = false, retries = 5, delay = 500): Promise<void> {
		const deleteResult = await this.logRepo.delete(logId, softDelete);
		if (deleteResult.isFailure) {
			if (retries > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				await this.rollbackLogCreation(logId, softDelete, retries - 1, delay);
			}
			else {
				this.logger.error(`Error rolling back log creation for ${logId}`, deleteResult.error.toString());
			}
		}

		// NOTE: cache is updated via subscription to log repo updates, no need to update cache here
	}

	/*
	 * Roll back user update by updating user with original data (helper for log deletion)
	 *
	 * @param originalPersistenceDTO Original user DTO to roll back to
	 * @param retries Number of retries before giving up
	 * @param delay Delay in milliseconds between retries
	 */
	protected async rollBackUserUpdate(originalPersistenceDTO: UserPersistenceDTO, retries = 5, delay = 500): Promise<void> {
		const result = await this.userRepo.update(originalPersistenceDTO);
		if (result.isFailure) {
			if (retries > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				await this.rollBackUserUpdate(originalPersistenceDTO, retries - 1, delay);
			}
			else {
				this.logger.error(`Error rolling back user update for ${originalPersistenceDTO.userId}`, result.error.toString());
			}
		}
	}

	/*
	 * Subscribe to and dispatch handling of log and user repo events (constructor helper)
	 *
	 * @remark Uses events from user repo for log creation and deletion, as logs repo events have no user context
	 * @remark Uses events from log repo for log updates, as user repo events do not contain log data
	 */
	protected subscribeToRepoEvents(): void {
		// subscribe to user repo events
		this.subscriptions.push(this.userRepo.updates$.subscribe(async (event: any) => { // todo: sort out typing later
			await this.eventDispatcher.dispatch(event);
		}));

		// subscribe to log repo events
		this.subscriptions.push(this.logRepo.updates$?.subscribe(async (event: any) => { // todo: sort out typing later
			await this.eventDispatcher.dispatch(event);
		}));
	}	
	
	/*
	 * Convert array of conditioning logs into time series (aggregation helper)
	 */
	protected toConditioningLogSeries(logs: ConditioningLog<any, ConditioningLogDTO>[]): ConditioningLogSeries<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO> {
		// filter out any logs that do not have a start date, log id of logs missing start date
		const logsWithDates = logs.filter(log => {
			if (log.start !== undefined) return true;
			this.logger.warn(`Conditioning log ${log.entityId} has no start date, excluding from ConditioningLogSeries.`);
			return false;
		});
		
		// sort logs ascending by start date and time
		logsWithDates.sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
		// convert logs array to time series
		const series =  { 
			unit: 'ConditioningLog',
			start: logsWithDates.length > 0 ? logsWithDates[0].start ?? undefined : undefined,
			data: logsWithDates.map((log: ConditioningLog<any, ConditioningLogDTO>) => {
				return {
					timeStamp: log.start,
					value: log
				} as DataPoint<ConditioningLog<any, ConditioningLogDTO>>;
			}
		)};

		return series;
	}	
}

export default ConditioningDataService;