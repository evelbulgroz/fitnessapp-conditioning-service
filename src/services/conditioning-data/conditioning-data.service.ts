import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { AggregatedTimeSeries, DataPoint } from '@evelbulgroz/time-series'
import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { EntityId, Logger } from '@evelbulgroz/ddd-base';
import { Quantity } from '@evelbulgroz/quantity-class';
import { Query } from '@evelbulgroz/query-fns';

import { AggregationQueryDTO } from '../../dtos/sanitization/aggregation-query.dto';
import { AggregatorService } from '../aggregator/aggregator.service';
import { ConditioningData } from '../../domain/conditioning-data.model';
import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../../dtos/domain/conditioning-log.dto';
import { ConditioningLogRepository } from '../../repositories/conditioning-log.repo';
import { ConditioningLogSeries } from '../../domain/conditioning-log-series.model';
import { DomainEventHandler } from '../../handlers/domain-event.handler';
import { EntityIdDTO } from '../../dtos/sanitization/entity-id.dto';
import { EventDispatcher } from '../event-dispatcher/event-dispatcher.service';
import { QueryDTO } from '../../dtos/sanitization/query.dto';
import { QueryMapper } from './../../mappers/query.mapper';
import { NotFoundError } from '../../domain/not-found.error';
import { PersistenceError } from '../../domain/persistence.error';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../domain/user-context.model';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user.repo';
import { UnauthorizedAccessError } from '../../domain/unauthorized-access.error';

/** Helper function to default sort logs ascending by start date and time */
function compareLogsByStartDate(a: ConditioningLog<any, ConditioningLogDTO>, b: ConditioningLog<any, ConditioningLogDTO>): number {
	return (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0);
}

/** Represents a query for conditioning logs (typing shorthand) */
type QueryType = Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>;

/** Specifies the properties of a user logs cache entry **/
interface UserLogsCacheEntry {
	userId: EntityId;
	logs: ConditioningLog<any, ConditioningLogDTO>[];
	lastAccessed?: Date;
}

/** Provides access to data from conditioning training sessions, as intermediary between controller and repositories.
 * @remark Handles enforcement of business rules, aggregation and other data processing unrelated to either persistence or request data sanitization.
 * @remark Uses a local cache to store logs by user id, to avoid repeated fetches from the persistence layer.
 * @remark Relies on repositories for persistence, and on controller(s) for request authentication, user context, data sanitization, and error logging.
 * @remark For now, Observable chain ends here with methods that return single-shot promises, since there are currently no streaming endpoints in the API.
 * @remark Admins can access all logs, other users can only access their own logs.
 */
@Injectable()
export class ConditioningDataService implements OnModuleDestroy {
	
	//------------------------- PRIVATE PROPERTIES --------------------------//
	
	protected readonly userLogsSubject = new BehaviorSubject<UserLogsCacheEntry[]>([]); // local cache of logs by user id in user microservice
	protected isInitializing = false; // flag to indicate whether initialization is in progress, to avoid multiple concurrent initializations
	protected readonly subscriptions: Subscription[] = []; // array to hold subscriptions to unsubsribe on destroy
	
	// Inject separately to keep constructor signature clean
	@Inject(Logger) protected readonly logger: Logger;
	@Inject(QueryMapper) protected readonly queryMapper: QueryMapper<QueryType, QueryDTO>;
	
	//----------------------------- CONSTRUCTOR -----------------------------//

	public constructor(
		protected readonly aggregator: AggregatorService,
		protected readonly eventDispatcher: EventDispatcher,
		protected readonly logRepo: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		protected readonly userRepo: UserRepository<any, UserDTO>
	) {
		this.subscribeToRepoEvents(); // deps not intialized in onModuleInit, so subscribe here
	}

	//----------------------------LIFECYCLE HOOKS ---------------------------//

	onModuleDestroy() {
		this.logger.log(`${this.constructor.name}: Shutting down...`);
		this.subscriptions.forEach((subscription) => subscription?.unsubscribe());
	}
	
	//------------------------------ PUBLIC API -----------------------------//
	
	/** New API: Check if service is ready to use, i.e. has been initialized
	 * @returns Promise that resolves when the service is ready to use
	 * @remark Invokes initialization if not already initialized
	 * @remark Only applies to new API, old API handles initialization internally
	*/	
	public async isReady(): Promise<boolean> {
		return new Promise(async (resolve) => {
			if (this.userLogsSubject.value.length === 0) { // load logs if cache is empty
				try {
					await this.initializeCache();
				}
				catch (error) {
					resolve(false);
					return; // exit early on error
				}
			}
			resolve(true);
		});
	}	

	/** New API: Create a new conditioning log for a user
	 * @param ctx User context for the request (includes user id and roles)
	 * @param userIdDTO User id of the user for whom to create the log, wrapped in a DTO
	 * @param logDTO DTO for conditioning log to create
	 * @returns Entity id of the created log
	 * @throws UnauthorizedAccessError if user is not authorized to create log
	 * @throws NotFoundError if user does not exist in persistence
	 * @throws PersistenceError if error occurs while creating log or updating user in persistence
	 * @logs Error if error occurs while rolling back log creation 
	 * @remark Logs and users are created/updated in the persistence layer, and propagated to cache via subscription
	 * @remark Admins can create logs for any user, other users can only create logs for themselves
	 */
	public async createLog(
		ctx: UserContext,
		userIdDTO: EntityIdDTO,
		logDTO: ConditioningLogDTO
	): Promise<EntityId> {
		// initialize service if necessary
		await this.isReady();

		// check if user is authorized to create log
		if (!ctx.roles.includes('admin')) { // admin has access to all logs, authorization check not needed
			if (userIdDTO.value !== ctx.userId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to create log for user ${userIdDTO.value}.`);
			}
		}

		// check if user exists in persistence layer
		const userResult = await this.userRepo.fetchById(userIdDTO.value!);
		if (userResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: User ${userIdDTO.value} not found.`);
		}

		// create log in persistence layer
		const result = await this.logRepo.create(logDTO);
		if (result.isFailure) { // creation failed -> throw persistence error
			throw new PersistenceError(`${this.constructor.name}: Error creating conditioning log: ${result.error}`);
		}
		const newLog = result.value as ConditioningLog<any, ConditioningLogDTO>;

		// add log to user in persistence layer, roll back log creation if user update fails
		const user = await firstValueFrom(userResult.value as Observable<User>);
		user.addLog(newLog.entityId!);
		const userUpdateResult = await this.userRepo.update(user.toJSON());
		if (userUpdateResult.isFailure) { // user update failed -> roll back log creation, then throw persistence error
			this.deleteOrphanedLog(newLog.entityId!); // deleting orphaned log from log repo, retry if necessary
			throw new PersistenceError(`${this.constructor.name}: Error updating user ${userIdDTO.value}: ${userUpdateResult.error}`);
		}

		// log created successfully -> return entity id
		return Promise.resolve(newLog.entityId!);
	}
	
	/** New API: Get single, detailed conditioning log by log entity id
	 * @param ctx user context for the request (includes user id and roles)
	 * @param userIdDTO Entity id of the user for whom to retrieve the log, wrapped in a DTO
	 * @param logIdDTO Entity id of the conditioning log to retrieve, wrapped in a DTO
	 * @returns Detailed log matching the entity id, if found and authorized
	 * @throws UnauthorizedAccessError if user is not authorized to access log
	 * @throws NotFoundError if log is not initialized in cache or not found in persistence
	 * @throws PersistenceError if error occurs while fetching log from persistence
	 * @remark Replaces overview log in cache with detailed log from persistence on demand, and updates cache subscribers
	 */
	public async fetchLog(ctx: UserContext, userIdDTO: EntityIdDTO, logIdDTO: EntityIdDTO): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		return new Promise(async (resolve, reject) => {
			await this.isReady(); // initialize service if necessary

			const logId = logIdDTO.value; // extract sanitized entity id from DTO

			// check if user id matches context decoed from access token
			if (!ctx.roles.includes('admin')) { // admin has access to all logs, authorization check not needed
				if (userIdDTO.value !== ctx.userId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
					reject(new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to access log for user ${userIdDTO.value}.`));
					return;
				}
			}
			
			// check if log exists in cache
			const entryWithLog = this.userLogsSubject.value.find((entry) => entry.logs.some((log) => log.entityId === logId));
			if (!entryWithLog) { // log not found in cache, cannot assess authorization -> throw NotFoundError
				reject(new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found or access denied.`));
				return;
			}
				
			// log exists, check if user is authorized to access it
			if (!ctx.roles.includes('admin')) { // admin has access to all logs, authorization check not needed
				const logOwnwerId = entryWithLog.userId;
				if (logOwnwerId !== ctx.userId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
					reject(new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to access log ${logId} for user ${logOwnwerId}.`));
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
					this.userLogsSubject.next([...this.userLogsSubject.value]); // update cache with shallow copy to trigger subscribers
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

	/** New API: Update an existing conditioning log for a user
	 * @param ctx User context for the request (includes user id and roles)
	 * @param logIdDTO Entity id of the conditioning log to update, wrapped in a DTO
	 * @param logDTO Partial conditioning log DTO with updated properties
	 * @returns void
	 * @throws UnauthorizedAccessError if user is not authorized to update log
	 * @throws NotFoundError if log is not found in persistence
	 * @throws PersistenceError if error occurs while updating log in persistence
	 * @remark Logs are updated in the persistence layer, and propagated to cache via subscription
	 * @remark Admins can update logs for any user, other users can only update logs for themselves
	 */
	public async updateLog(
		ctx: UserContext,
		userIdDTO: EntityIdDTO,
		logIdDTO: EntityIdDTO,
		logDTO: Partial<ConditioningLogDTO>
	): Promise<void> {
		await this.isReady(); // initialize service if necessary

		// check if user is authorized to update log
		if (!ctx.roles.includes('admin')) { // admin has access to all logs, authorization check not needed
			if (userIdDTO.value !== ctx.userId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to update log for user ${userIdDTO.value}.`);
			}
		}

		// check if log exists in repo, else throw NotFoundError
		const logResult = await this.logRepo.fetchById(logIdDTO.value!);
		if (logResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: Conditioning log ${logIdDTO.value} not found.`);
		}

		// update log in persistence layer
		logDTO.entityId = logIdDTO.value; // ensure entity id is set in DTO
		const logUpdateResult = await this.logRepo.update(logDTO);
		if (logUpdateResult.isFailure) { // update failed -> throw persistence error
			throw new PersistenceError(`${this.constructor.name}: Error updating conditioning log ${logIdDTO.value}: ${logUpdateResult.error}`);
		}

		// succcess -> resolve with void
		return Promise.resolve();		
	}

	/** New API: Delete a conditioning log by entity id
	 * @param ctx User context for the request (includes user id and roles)
	 * @param logIdDTO Entity id of the conditioning log to delete, wrapped in a DTO
	 * @returns void
	 * @throws UnauthorizedAccessError if user is not authorized to delete log
	 * @throws NotFoundError if either log or user is not found in persistence
	 * @throws PersistenceError if error occurs while deleting log or updating user in persistence
	 * @remark Logs are deleted from the persistence layer, and propagated to cache via subscription
	 * @remark Admins can delete logs for any user, other users can only delete logs for themselves
	 */
	public async deleteLog(
		ctx: UserContext,
		userIdDTO: EntityIdDTO,
		logIdDTO: EntityIdDTO
	): Promise<void> {
		// initialize service if necessary
		await this.isReady();

		// check if user is authorized to delete log
		if (!ctx.roles.includes('admin')) { // admin has access to all logs, authorization check not needed
			if (userIdDTO.value !== ctx.userId) { // user is not admin and not owner of log -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to create log for user ${userIdDTO.value}.`);
			}
		}

		// check if log exists in persistence layer
		const logResult = await this.logRepo.fetchById(logIdDTO.value!);
		if (logResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: Conditioning log ${logIdDTO.value} not found.`);
		}

		// check if user exists in persistence layer
		const userResult = await this.userRepo.fetchById(userIdDTO.value!);
		if (userResult.isFailure) { // fetch failed -> throw persistence error
			throw new NotFoundError(`${this.constructor.name}: User ${userIdDTO.value} not found.`);
		}
		
		// update user in persistence layer:
		// rolling back log deletion is harder than rolling back user update, so update user first
		const user = await firstValueFrom(userResult.value as Observable<User>);
		const originalUserDTO = user.toJSON();
		user.removeLog(logIdDTO.value!);
		const userUpdateResult = await this.userRepo.update(user.toJSON());
		if (userUpdateResult.isFailure) { // update failed -> throw persistence error
			throw new PersistenceError(`${this.constructor.name}: Error updating user ${userIdDTO.value}: ${userUpdateResult.error}`);
		}

		// delete log in persistence layer
		const logDeleteResult = await this.logRepo.delete(logIdDTO.value!);
		if (logDeleteResult.isFailure) { // deletion failed -> roll back user update, then throw persistence error
			this.rollBackUserUpdate(user, originalUserDTO); // retry rolling back user update before continuing
		}		
		
		// log deleted successfully -> return undefined
		return Promise.resolve();
	}

	/** New API: Get all conditioning logs for user and mathcing query (if provided)
	 * @param ctx user context for the request (includes user id and roles)
	 * @param queryDTO Optional query to filter logs (else all accessible logs for role are returned)
	 * @returns Array of conditioning logs (constrained by user context and query)
	 * @throws UnauthorizedAccessError if user attempts authorized access to logs
	 * @remark Overview logs are guaranteed to be available
	 * @remark Full logs are loaded into cache from persistence on demand using conditioningLogDetails(), and may be replaced in cache with overview logs to save memory
	 */
	public async fetchLogs(
		ctx: UserContext,
		userIdDTO: EntityIdDTO,
		queryDTO?: QueryDTO
	): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		await this.isReady(); // initialize service if necessary

		// check if provided user id matches context decoded from access token
		if (!ctx.roles.includes('admin')) { // admin has access to all logs, authorization check not needed
			if (userIdDTO?.value !== ctx.userId) { // user id does not match -> throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to access logs for user ${userIdDTO.value}.`);
			}
		}
		
		let accessibleLogs: ConditioningLog<any, ConditioningLogDTO>[];		
		if (!ctx.roles.includes('admin')) { // if the user isn't an admin, they can only access their own logs
			if (queryDTO?.userId && queryDTO.userId !== ctx.userId) { // if query specifies a different user id, throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to access logs for user ${queryDTO.userId}.`);
			}						
			accessibleLogs = this.userLogsSubject.value.find((entry) => entry.userId === ctx.userId)?.logs ?? [];
		}
		else { // if the user is an admin, they can access all logs
			accessibleLogs = this.userLogsSubject.value.flatMap((entry) => entry.logs);
		}
		
		// filter logs by query, if provided, else use all accessible logs
		let query: QueryType | undefined;
		if (queryDTO) { // map query DTO, if provided, to library query for processing logs
			queryDTO.userId = undefined; // logs don't have a user id field, so remove it from query
			query = this.queryMapper.toDomain(queryDTO); // mapper excludes dto props that are undefined
		}
		const matchingLogs = query ? query.execute(accessibleLogs) : accessibleLogs;
		
		let sortedLogs = matchingLogs;
		if (!query?.sortCriteria || query.sortCriteria.length === 0) {// default sort is ascending by start date and time
			sortedLogs = matchingLogs.sort(compareLogsByStartDate);
		}
		
		return Promise.resolve(sortedLogs);
	}

	/** New API: Get aggregated time series of conditioning logs
	 * @param ctx User context for the request (includes user id and roles)
	 * @param aggregationQueryDTO Validated aggregation query DTO speficifying aggregation parameters
	 * @param queryDTO Optional query to select logs to aggregate (else all accessible logs are aggregated)
	 * @returns Aggregated time series of conditioning logs
	 * @throws UnauthorizedAccessError if user attempts unauthorized access to logs
	 */
	public async fetchaggretagedLogs(
		ctx: UserContext,
		aggregationQueryDTO: AggregationQueryDTO,
		queryDTO?: QueryDTO
	): Promise<AggregatedTimeSeries<ConditioningLog<any, ConditioningLogDTO>, any>> {
		await this.isReady(); // initialize service if necessary

		// constrain searchable logs to single user if user id is provided
		let accessibleLogs: ConditioningLog<any, ConditioningLogDTO>[];
		if (!ctx.roles.includes('admin')) { // if the user isn't an admin, they can only access their own logs
			if (queryDTO?.userId && queryDTO.userId !== ctx.userId) { // if query specifies a different user id, throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to access logs for user ${queryDTO.userId}.`);
			}
			accessibleLogs = this.userLogsSubject.value.find((entry) => entry.userId === ctx.userId)?.logs ?? [];
		}
		else { // if the user is an admin, they can access all logs
			accessibleLogs = this.userLogsSubject.value.flatMap((entry) => entry.logs);
		}

		// filter logs by query, if provided, else use all accessible logs
		let query: QueryType | undefined;
		if (queryDTO) { // map query DTO, if provided, to library query for processing logs
			queryDTO.userId = undefined; // logs don't have a user id field, so remove it from query
			query = this.queryMapper.toDomain(queryDTO); // mapper excludes dto props that are undefined
		}
		const matchingLogs = query ? query.execute(accessibleLogs) : accessibleLogs;

		// convert searchable logs matching query to time series
		const timeSeries = this.toConditioningLogSeries(matchingLogs);

		// aggregate time series
		const aggregatedSeries = this.aggregator.aggregate(
			timeSeries,
			aggregationQueryDTO,
			(dataPoint: DataPoint<any>) => { // value extractor for Quantity values
				const propValue = dataPoint.value[aggregationQueryDTO.aggregatedProperty as keyof ConditioningLog<any, ConditioningLogDTO>];
				if (propValue instanceof Quantity) {
					return propValue.to(aggregationQueryDTO.aggregatedValueUnit ?? '').scalar;
				}
				else {
					return propValue
				}
			}
		);
		return Promise.resolve(aggregatedSeries);		
	}

	/** Get user logs cache for domain event handlers
	 * @param caller Domain event handler requesting access to user logs cache
	 * @returns Array of user logs cache entries (shallow copy of cache)
	 * @throws UnauthorizedAccessError if caller is not a domain event handler
	 * @remark Used by domain event handlers to access user logs cache
	 */
	public getCacheSnapshot(caller: DomainEventHandler<any>): UserLogsCacheEntry[] {
		if (!(caller instanceof DomainEventHandler)) {
			throw new UnauthorizedAccessError('Unauthorized access: only domain event handlers can access user logs cache.');
		}
		return [...this.userLogsSubject.value];
	}

	/** Update user logs cache for domain event handlers
	 * @param newCache New cache to replace existing cache
	 * @param caller Domain event handler updating user logs cache
	 * @returns void
	 * @throws UnauthorizedAccessError if caller is not a domain event handler
	 * @remark Used by domain event handlers to update user logs cache
	 */
	public updateCache(newCache: UserLogsCacheEntry[], caller: DomainEventHandler<any>): void {
		if (!(caller instanceof DomainEventHandler)) {
			throw new UnauthorizedAccessError('Unauthorized access: only domain event handlers can update user logs cache.');
		}
		this.userLogsSubject.next(newCache);
	}
	
	/** In production: Get aggregated conditioning data with series from all activities */
	public async conditioningData(userId?: EntityId): Promise<ConditioningData> {	
		await this.isReady(); // lazy load logs if necessary
		let logs: ConditioningLog<any, ConditioningLogDTO>[];
		if (userId !== undefined) {
			const cacheEntry = this.userLogsSubject.value.find((entry) => entry.userId === userId);
			logs = cacheEntry?.logs ?? [];
		}
		else {
			logs = this.userLogsSubject.value.flatMap((entry) => entry.logs);
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

	//-------------------------- PROTECTED METHODS --------------------------//

	/* Initialize user-log cache */
	protected async initializeCache(): Promise<void> {		
		const cache = this.userLogsSubject;
		
		// initialization already in progress, wait for it to complete
		if (this.isInitializing) { 
			const readyPromise = new Promise<void>((resolve) => { // resolves when initialization is complete
				cache.pipe(
					filter((data) => data.length > 0), // wait for cache to be populated
					take(1)
				).subscribe(() => {
					this.isInitializing = false;
					resolve(); // resolve with void
				});
			});
			return readyPromise;
		}
		
		// cache already initialized
		if (cache.value.length > 0) { 
			return Promise.resolve(); // resolve with void
		}

		// cache not initialized, initialization not in progress -> initialize it
		this.isInitializing = true;
		this.logger.log(`${this.constructor.name}: Initializing cache...`);

		// fetch all logs from conditioning log repo
		let allLogs: ConditioningLog<any, ConditioningLogDTO>[] = [];
		const logsResult = await this.logRepo.fetchAll();
		if (logsResult.isSuccess) {
			const allLogs$ = logsResult.value as Observable<ConditioningLog<any, ConditioningLogDTO>[]>;
			allLogs = await firstValueFrom(allLogs$.pipe(take(1)));
			allLogs.sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0)); // sort logs ascending by start date and time, if available
		}
		else {
			this.logger.error(`${this.constructor.name}: Error initializing conditioning logs: ${logsResult.error}`);
			this.isInitializing = false;
		}
		
		// fetch all users from user repo
		let users: User[] = [];
		const usersResult = await this.userRepo.fetchAll();
		if (usersResult.isSuccess) {
			const users$ = usersResult.value as Observable<User[]>;
			users = await firstValueFrom(users$.pipe(take(1)));
		}
		else {
			this.logger.error(`${this.constructor.name}: Error initializing user logs: ${usersResult.error}`);
		}

		// combine logs and users into user logs cache entries
		const now = new Date();
		const userLogs: UserLogsCacheEntry[] = users.map((user: User) => {	
			const logs = allLogs.filter((log) => user.logs.includes(log.entityId!));
			return { userId: user.userId!, logs: logs, lastAccessed: now };
		});
		this.userLogsSubject.next(userLogs);
		
		this.isInitializing = false;
		this.logger.log(`${this.constructor.name}: Initialization complete: Cached ${allLogs.length} logs for ${users.length} users.`);

		return Promise.resolve(); // resolve with void
	}

	/* Purge log from log repo that has been orphaned by failed user update (log creation helper)
	 * @param logId Entity id of the log to purge from the log repo
	 * @param retries Number of retries before giving up
	 * @param delay Delay in milliseconds between retries
	 */ 
	protected async deleteOrphanedLog(logId: EntityId, retries = 5, delay = 500): Promise<void> {
		const result = await this.logRepo.delete(logId);
		if (result.isFailure) {
			if (retries > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				await this.deleteOrphanedLog(logId, retries - 1, delay);
			}
			else {
				this.logger.error(`${this.constructor.name}: Error deleting orphaned log ${logId} from log repo: ${result.error}`);
			}
		}
	}

	/* Roll back user update by updating user with original data (helper for log deletion)
	 * @param user User entity to roll back
	 * @param originalDTO Original user DTO to roll back to
	 * @param retries Number of retries before giving up
	 * @param delay Delay in milliseconds between retries
	 */
	protected async rollBackUserUpdate(user: User, originalDTO: UserDTO, retries = 5, delay = 500): Promise<void> {
		const result = await this.userRepo.update(originalDTO);
		if (result.isFailure) {
			if (retries > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				await this.rollBackUserUpdate(user, originalDTO, retries - 1, delay);
			}
			else {
				this.logger.error(`${this.constructor.name}: Error rolling back user update for ${user.userId}: ${result.error}`);
			}
		}
	}

	/* Subscribe to and dispatch handling of log and user repo events (constructor helper)
	 * @remark Uses events from user repo for log creation and deletion, as logs repo events have no user context
	 * @remark Uses events from log repo for log updates, as user repo events do not contain log data
	 */
	protected subscribeToRepoEvents(): void {
		// subscribe to user repo events
		this.subscriptions.push(this.userRepo.updates$.subscribe((event) => {
			this.eventDispatcher.dispatch(event as any); // todo: sort out typing later
		}));

		// subscribe to log repo events
		this.subscriptions.push(this.logRepo.updates$?.subscribe((event) => {
			this.eventDispatcher.dispatch(event as any); // todo: sort out typing later
		}));
	}	
	
	/* Convert array of conditioning logs into time series (aggregation helper) */
	protected toConditioningLogSeries(logs: ConditioningLog<any, ConditioningLogDTO>[]): ConditioningLogSeries<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO> {
		// filter out any logs that do not have a start date, log id of logs missing start date
		const logsWithDates = logs.filter(log => {
			if (log.start !== undefined) return true;
			this.logger.warn(`${this.constructor.name}: Conditioning log ${log.entityId} has no start date, excluding from ConditioningLogSeries.`);
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