import { Inject, Injectable } from '@nestjs/common';

import { BehaviorSubject, filter, firstValueFrom, Observable, Subscription, take } from 'rxjs';

import { AggregationQuery as LibAggregationQuery, AggregatedTimeSeries, DataPoint } from '@evelbulgroz/time-series'
import { ActivityType } from '@evelbulgroz/fitnessapp-base';
import { EntityId, Logger } from '@evelbulgroz/ddd-base';
import { Quantity } from '@evelbulgroz/quantity-class';

import { AggregationQuery } from '../../controllers/domain/aggregation-query.model';
//import { AggregatorService } from '../aggregator/aggregator.service';
import { ConditioningData } from '../../domain/conditioning-data.model';
import { ConditioningLog } from '../../domain/conditioning-log.entity';
import { ConditioningLogDTO } from '../../dtos/conditioning-log.dto';
import { ConditioningLogRepo } from '../../repositories/conditioning-log-repo.model';
import { Query } from '@evelbulgroz/query-fns';
import { ConditioningLogSeries } from '../../domain/conditioning-log-series.model';
import { LogsQuery } from '../../controllers/domain/logs-query.model';;
import { User } from '../../domain/user.entity';
import { UserContext } from '../../controllers/domain/user-context.model';
import { UserDTO } from '../../dtos/user.dto';
import { UserRepository } from '../../repositories/user-repo.model';

function compareLogsByStartDate(a: ConditioningLog<any, ConditioningLogDTO>, b: ConditioningLog<any, ConditioningLogDTO>): number {
	return (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0);
}

/** Specifies the properties of a user logs cache entry **/
interface UserLogsCacheEntry {
	userId: EntityId;
	logs: ConditioningLog<any, ConditioningLogDTO>[];
}

/** Provide access to data from conditioning training sessions.
 * @remarks Exists to relieve repo from having to handle aggregation and other data processing unrelated to persistence.
 * @remarks For now, Observable chain ends here with methods that return single-shot promises, since there are no streaming endpoints in the API.
 * @remarks Refactor to observables if/as needed, e.g. by controller serving via Web Sockets instead of HTTP.
 * @todo Refactor service and cache to orchestrate user and log data (e.g. adding entries to both when adding a new log for a user).
 * 
 */
@Injectable()
export class ConditioningDataService {
	protected readonly userLogsSubject = new BehaviorSubject<UserLogsCacheEntry[]>([]); // local cache of logs by user id in user microservice (todo: implement deserialization and synchronization)

	#isInitializing = false; // flag to indicate whether initialization is in progress, to avoid multiple concurrent initializations

	@Inject(Logger) private readonly logger: Logger;
	
	//--------------------------------- CONSTRUCTOR ---------------------------------

	constructor(
		//private readonly aggregator: AggregatorService,
		private readonly logRepo: ConditioningLogRepo<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly userRepo: UserRepository<any, UserDTO>
	) { }

	//--------------------------------- PUBLIC API ---------------------------------
	
	/**New API: Check if service is ready to use, i.e. has been initialized
	 * @returns Promise that resolves when the service is ready to use
	 * @remarks Invokes initialization if not already initialized
	 * @remarks Only applies to new API, old API handles initialization internally
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
	
	/**New API:  Get detail for a single, existing conditioning log by entity id
	 * @param logId Entity id of the conditioning log
	 * @param userId Optional user id to filter logs by user (if not provided, all logs are searched)
	 * @returns Detailed log, or undefined if not found
	 * @remarks Will repopulate details even if log is already detailed
	 * @remarks Constrains search to logs for a single user if user id is provided; controller should handle user access
	 */
	public async conditioningLogDetails(logId: EntityId, userId?: EntityId): Promise<ConditioningLog<any, ConditioningLogDTO> | undefined> {
		return new Promise(async (resolve, reject) => {
			await this.isReady(); // lazy load logs if necessary
			
			let cacheEntry: UserLogsCacheEntry | undefined;			
			if (userId !== undefined) { // find cache entry by user id, if provided
				cacheEntry = this.userLogsSubject.value.find((entry) => entry.userId === userId);
				if (cacheEntry === undefined) {
					resolve(undefined); // user not found, return undefined
					return; // exit early
				}				
			}
			else { // find cache entry by log id
				cacheEntry = this.userLogsSubject.value.find((entry) => entry.logs.some((log) => log.entityId === logId));
				if (cacheEntry === undefined) {
					resolve(undefined); // log not found, return undefined
					return; // exit early
				}
			}
			
			// find log by entity id
			let originalLog: ConditioningLog<any, ConditioningLogDTO> | undefined;
			const index = cacheEntry.logs.findIndex(log => log.entityId === logId);
			
			if (index > -1) { // found in cache
				originalLog = cacheEntry!.logs[index];

				const result = await this.logRepo.fetchById(logId);
				if (result.isFailure) { // error, reject
					reject(result.error);
					return; // exit early
				}

				const detailedLog$ = result.value as Observable<ConditioningLog<any, ConditioningLogDTO>>;
				const detailedLog = await firstValueFrom(detailedLog$.pipe(take(1)));
				if (detailedLog !== undefined) { // detailed log available										
						// fetchById returns a detailed log, so replace original log in cache
						cacheEntry!.logs[index] = detailedLog; // update cache
						resolve(detailedLog); // return detailed log
				}
				else { // not found, remove from cache and resolve
					cacheEntry!.logs.splice(index, 1);
					resolve(undefined);
				}				
			}
			else { // not found in cache, resolve undefined
				resolve(undefined);
			}			
		});
	}

	/**New API: Get all conditioning logs
	 * @param userId Optional user id to filter logs by user
	 * @returns Array of conditioning logs (for user if specified)
	 * @note Overviews are guaranteed to be available, full logs are loaded on demand
	 * @todo Refactor to use query not user id, to allow for more complex queries
	 */
	public async conditioningLogs(userId?: EntityId | LogsQuery, ctx?: UserContext): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		await this.isReady(); // lazy load logs if necessary
		if (userId !== undefined) {
			const cacheEntry = this.userLogsSubject.value.find((entry) => entry.userId === userId);
			return cacheEntry?.logs.sort(compareLogsByStartDate) ?? [];
		}			
		return this.userLogsSubject.value.flatMap((entry) => entry.logs);
	}

	/**New API: Get aggregated time series of conditioning logs by query
	 * @param aggregationQuery Validated aggregation query DTO
	 * @param logsQuery Optional query to filter logs before aggregation (else all logs are aggregated)
	 * @param userId Optional user id to filter logs by user
	 * @returns Aggregated time series of conditioning logs
	 * @todo Convert logsQuery to ConditioningLogQuery
	 */
	public async aggretagedConditioningLogs(aggregationQuery: AggregationQuery, logsQuery?: LogsQuery, userId?: EntityId): Promise<AggregatedTimeSeries<ConditioningLog<any, ConditioningLogDTO>, any>> {
		/*await this.isReady(); // lazy load logs if necessary

		// convert logs matching query to time series
		let matchingLogs: ConditioningLog<any, ConditioningLogDTO>[];
		if (logsQuery !== undefined) {
			matchingLogs = await this.getByQuery(logsQuery as any, userId); // todo: convert logsQuery to ConditioningLogQuery
		}
		else if (userId !== undefined) {
			const cacheEntry = this.userLogsSubject.value.find((entry) => entry.userId === userId);
			if (cacheEntry === undefined) return Promise.resolve([] as any); // user not found, return empty array
			matchingLogs = cacheEntry.logs;
		}
		else {
			matchingLogs = this.userLogsSubject.value.flatMap((entry) => entry.logs);
		}
		const timeSeries: ConditioningLogSeries<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO> = this.toConditioningLogSeries(matchingLogs);

		// aggregate time series
		const aggregatedSeries = this.aggregator.aggregate(
			timeSeries,
			aggregationQuery as unknown as LibAggregationQuery, // local type is compatible with library type -> cast, don't convert
			(dataPoint: DataPoint<ConditioningLog<any, ConditioningLogDTO>>) => {
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
		*/
		return Promise.resolve({} as any); // debug: return empty object for now
		
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

	/** DEPRECATED: Get conditioning logs by query (aggregation helper)
	 * @param query Conditioning log query
	 * @param userId Optional user id to filter logs by user
	 * @returns Array of conditioning logs matching query (for user if specified)
	 * @remarks Logs are sorted by start date and time, if available
	 */
	public async getByQuery(query: Query<any,any>, userId?: EntityId): Promise<ConditioningLog<any, ConditioningLogDTO>[]> {
		/*
		await this.isReady(); // lazy load logs if necessary
		
		// helper functions
		const matchesSearchCriteria = (log: ConditioningLog<any, ConditioningLogDTO>): boolean => {
			return query.searchCriteria
				.map((criterion) => criterion(log))
				.every((match) => match); // all are true	
		}
		
		const matchesFilter = (log: ConditioningLog<any, ConditioningLogDTO>): boolean => {
			return (!query.filterCriteria || query.filterCriteria.length === 0) ? true // no filter criteria, all match by default
			: query.filterCriteria // filter criteria defined, test that all match
				.map((criterion) => criterion(log))
				.every((match) => match); // all are true	
		}
		
		const executeSort = (logs: ConditioningLog<any, ConditioningLogDTO>[]): ConditioningLog<any, ConditioningLogDTO>[] => {
			query.sortCriteria?.forEach((criterion) => {
				logs = criterion(logs) as ConditioningLog<any, ConditioningLogDTO>[];
			});
			return logs;
		}

		let logsToQuery: ConditioningLog<any, ConditioningLogDTO>[];
		if (userId !== undefined) {
			const cacheEntry = this.userLogsSubject.value.find((entry) => entry.userId === userId);
			if (cacheEntry === undefined) return Promise.resolve([]); // user not found, return empty array
			logsToQuery = cacheEntry.logs;
		}
		else {
			logsToQuery = this.userLogsSubject.value.flatMap((entry) => entry.logs);
		}

		// execute query and return results
		const result = executeSort( // sort matching logs
			logsToQuery // start with all logs
			.filter((e) => matchesSearchCriteria(e)) // find entities matching search criteria
			.filter((e) => matchesFilter(e)) // find entities matching filter criteria
		);
		return Promise.resolve(result);
		*/
		return Promise.resolve([]); // debug: return empty array for now
	}

	//--------------------------------- PROTECTED METHODS ---------------------------------

	/* Convert a LogsQuery to a (functional) ConditioningLogQuery */
	protected toConditioningLogQuery(query: LogsQuery): Query<any, any> {
		// todo: implement conversion
		/* DTO format example: {
			"searchCriteria": [
				{
					"operation": "EQUALS",
					"key": "activity",
					"value": "MTB",
					"negate": true
				}
			],
			"filterCriteria": [
				{
					"operation": "GREATER_THAN",
					"key": "duration",
					"value": "50000",
					"unit": "ms"
				}
			],
			"sortCriteria": [
				{
					"operation": "DESC",
					"key": "duration",
					"unit": "ms"
				}
			]
		},
		*/
		//return new ConditioningLogQuery({} as any); // debug: return empty query for now
		return {} as any; // debug: return empty query for now
	}

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
