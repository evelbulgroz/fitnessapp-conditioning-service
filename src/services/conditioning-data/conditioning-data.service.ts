import { Inject, Injectable } from '@nestjs/common';

import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { AggregatedTimeSeries, DataPoint } from '@evelbulgroz/time-series'
import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { EntityId, Logger } from '@evelbulgroz/ddd-base';
import { Quantity } from '@evelbulgroz/quantity-class';
import { Query, SearchFilterOperation, SortOperation } from '@evelbulgroz/query-fns';

import { AggregationQueryDTO } from '../../controllers/dtos/aggregation-query.dto';
import { AggregatorService } from '../aggregator/aggregator.service';
import { ConditioningData } from '../../domain/conditioning-data.model';
import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../../dtos/conditioning-log.dto';
import { ConditioningLogRepo } from '../../repositories/conditioning-log-repo.model';
import { ConditioningLogSeries } from '../../domain/conditioning-log-series.model';
import { EntityIdDTO } from '../../controllers/dtos/entityid.dto';
import { QueryDTO } from '../../controllers/dtos/query.dto';
import { NotFoundError } from '../../domain/not-found.error';
import { PersistenceError } from '../../domain/persistence.error';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../controllers/domain/user-context.model';
import { UserDTO } from '../../dtos/user.dto';
import { UserRepository } from '../../repositories/user-repo.model';
import { UnauthorizedAccessError } from '../../domain/unauthorized-access.error';
import { QueryMapper } from './../../mappers/query.mapper';

function compareLogsByStartDate(a: ConditioningLog<any, ConditioningLogDTO>, b: ConditioningLog<any, ConditioningLogDTO>): number {
	return (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0);
}

/** Represents a query for conditioning logs (typing shorthand) */
type QueryType = Query<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>;

/** Specifies the properties of a user logs cache entry **/
interface UserLogsCacheEntry {
	userId: EntityId;
	logs: ConditioningLog<any, ConditioningLogDTO>[];
}

/** Provides access to data from conditioning training sessions, as intermediary between controllers and repositories.
 * @remark Handles enforcement of business rules, and aggregation and other data processing unrelated to either persistence or controller logic.
 * @remark Uses a local cache to store logs by user id, to avoid repeated fetches from the persistence layer.
 * @remark Relies on repositories for persistence, and on controller(s) for request authentication, user context, data sanitization, and error logging.
 * @remark For now, Observable chain ends here with methods that return single-shot promises, since there are currently no streaming endpoints in the API.
 * @todo Refactor all data access methods to require UserContext instead of user id, to allow for more complex queries and enforce access rules.
 * @todo Refactor service and cache to orchestrate user and log data (e.g. adding entries to both when adding a new log for a user).
 */
@Injectable()
export class ConditioningDataService {
	//--------------------------------- PRIVATE PROPERTIES ---------------------------------
	
	protected readonly userLogsSubject = new BehaviorSubject<UserLogsCacheEntry[]>([]); // local cache of logs by user id in user microservice (todo: implement deserialization and synchronization)
	#isInitializing = false; // flag to indicate whether initialization is in progress, to avoid multiple concurrent initializations
	
	// Inject manually to keep constructor signature clean
	@Inject(Logger) private readonly logger: Logger;
	@Inject(QueryMapper) private readonly queryMapper: QueryMapper<QueryType, QueryDTO>;
	
	//--------------------------------- CONSTRUCTOR ---------------------------------

	constructor(
		private readonly aggregator: AggregatorService,
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository<any, UserDTO>
	) { }

	//--------------------------------- PUBLIC API ---------------------------------
	
	/**New API: Check if service is ready to use, i.e. has been initialized
	 * @returns Promise that resolves when the service is ready to use
	 * @remark Invokes initialization if not already initialized
	 * @remark Only applies to new API, old API handles initialization internally
	*/	
	public async isReady(): Promise<boolean> {
		return new Promise(async (resolve) => {
			if (this.userLogsSubject.value.length === 0) { // lazy load logs if necessary
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
	
	/**New API: Get single, detailed conditioning log by user and entity id
	 * @param ctx user context for the request (includes user id and roles)
	 * @param logId Entity id of the conditioning log to retrieve
	 * @returns Detailed log, or undefined if not found
	 * @throws NotFoundError if log is not found or access is denied
	 * @throws UnauthorizedAccessError if user is not authorized to access log
	 * @throws PersistenceError if error occurs while fetching log from persistence
	 * @remark Replaces overview logs in cache with detailed logs from persistence on demand, and updates subscribers
	 */
	public async conditioningLog(ctx: UserContext, id: EntityIdDTO): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		return new Promise(async (resolve, reject) => {
			await this.isReady(); // initialize service if necessary

			const logId = id.entityId; // extract sanitized entity id from DTO
			
			// check if log exists in cache, else throw NotFoundError
			const entryWithLog = this.userLogsSubject.value.find((entry) => entry.logs.some((log) => log.entityId === logId));
			if (!entryWithLog) { // log not found in cache, cannot assess authorization -> throw NotFoundError
				reject(new NotFoundError(`${this.constructor.name}: Conditioning log ${logId} not found or access denied.`));
				return;
			}
				
			// log exists, check if user is authorized to access it, else throw UnauthorizedAccessError
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
			else { // log is not detailed -> fetch full log from persistence
				const result = await this.logRepo.fetchById(logId!);
				if (result.isFailure) { // retrieval failed -> throw persistence error
					reject(new PersistenceError(`${this.constructor.name}: Error retrieving conditioning log ${logId} from persistence layer: ${result.error}`));
					return;
				}
				const detailedLog$ = result.value as Observable<ConditioningLog<any, ConditioningLogDTO>>;
				detailedLog = await firstValueFrom(detailedLog$.pipe(take(1)));
				if (detailedLog !== undefined) { // detailed log available					
					entryWithLog.logs[index] = detailedLog; // replace original log in cache
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

	/**New API: Get all conditioning logs matching user and query (if provided)
	 * @param ctx user context for the request (includes user id and roles)
	 * @param queryDTO Optional query to filter logs (else all available logs for role are returned)
	 * @returns Array of conditioning logs (constrained by user context and query)
	 * @throws UnauthorizedAccessError if user attempts authorized access to logs
	 * @remark Overview logs are guaranteed to be available
	 * @remark Full logs are loaded from persistence on demand using conditioningLogDetails(), and may be purged from cache to save memory
	 */
	public async conditioningLogs(ctx: UserContext, queryDTO?: QueryDTO): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		await this.isReady(); // initialize service if necessary
		
		let searchableLogs: ConditioningLog<any, ConditioningLogDTO>[];		
		if (!ctx.roles.includes('admin')) { // if the user isn't an admin, they can only access their own logs
			if (queryDTO?.userId && queryDTO.userId !== ctx.userId) { // if query specifies a different user id, throw UnauthorizedAccessError
				throw new UnauthorizedAccessError(`${this.constructor.name}: User ${ctx.userId} tried to access logs for user ${queryDTO.userId}.`);
			}						
			searchableLogs = this.userLogsSubject.value.find((entry) => entry.userId === ctx.userId)?.logs ?? [];
		}
		else { // if the user is an admin, they can access all logs			
			searchableLogs = this.userLogsSubject.value.flatMap((entry) => entry.logs);
		}
		
		let query: QueryType | undefined;
		if (queryDTO) { // map query DTO, if provided, to library query for processing logs
			queryDTO.userId = undefined; // logs don't have a user id field, so remove it from query
			query = this.queryMapper.toDomain(queryDTO); // mapper excludes dto props that are undefined
		}		

		// filter logs by query, if provided, else use all searchable logs
		const matchingLogs = query ? query.execute(searchableLogs) : searchableLogs;
		
		let sortedLogs = matchingLogs;
		if (!query?.sortCriteria || query.sortCriteria.length === 0) {// default sort is ascending by start date and time
			sortedLogs = matchingLogs.sort(compareLogsByStartDate);
		}
		
		return Promise.resolve(sortedLogs);
	}

	/**New API: Get aggregated time series of conditioning logs
	 * @param ctx User context for the request (includes user id and roles)
	 * @param aggregationQuery Validated aggregation query
	 * @param logsQuery Optional data query to select logs to aggregate (else all available logs are aggregated)
	 * @returns Aggregated time series of conditioning logs
	 * @remark Admins can access all logs, other users can only access their own logs
	 */
	public async aggretagedConditioningLogs(
		ctx: UserContext,
		aggregationQuery: AggregationQueryDTO,
		logsQuery?: Query<ConditioningLog<any,ConditioningLogDTO>, ConditioningLogDTO>
	): Promise<AggregatedTimeSeries<ConditioningLog<any, ConditioningLogDTO>, any>> {
		await this.isReady(); // initialize service if necessary

		// constrain searchable logs to single user if user id is provided
		let searchableLogs: ConditioningLog<any, ConditioningLogDTO>[];
		if (!ctx.roles.includes('admin')) { // if the user isn't an admin, they can only access their own logs
			searchableLogs = this.userLogsSubject.value.find((entry) => entry.userId === ctx.userId)?.logs ?? [];
		}
		else { // use all logs
			searchableLogs = this.userLogsSubject.value.flatMap((entry) => entry.logs);
		}

		// convert searchable logs matching query to time series
		const matchingLogs = logsQuery !== undefined ? logsQuery.execute(searchableLogs) : searchableLogs;
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
	
	/**In production: Get aggregated conditioning data with series from all activities */
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

	//--------------------------------- PROTECTED METHODS ---------------------------------

	/** Convert array of conditioning logs into time series (aggregation helper) */
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

	/** Initialize user-log cache */
	protected async initializeCache(): Promise<void> {		
		const cache = this.userLogsSubject;
		
		// initialization already in progress, wait for it to complete
		if (this.#isInitializing) { 
			const readyPromise = new Promise<void>((resolve) => { // resolves when initialization is complete
				cache.pipe(
					filter((data) => data.length > 0), // wait for cache to be populated
					take(1)
				).subscribe(() => {
					this.#isInitializing = false;
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
		this.#isInitializing = true;
		this.logger.log(`${this.constructor.name}: Initializing ...`);

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
			this.#isInitializing = false;
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
		const userLogs: UserLogsCacheEntry[] = users.map((user: User) => {	
			const logs = allLogs.filter((log) => user.logs.includes(log.entityId!));
			return { userId: user.userId!, logs: logs };
		});
		this.userLogsSubject.next(userLogs);
		
		this.#isInitializing = false;
		this.logger.log(`${this.constructor.name}: Initialization complete: Cached ${allLogs.length} logs for ${users.length} users.`);

		return Promise.resolve(); // resolve with void
	}	
}

export default ConditioningDataService;
