import { Injectable, Optional, Inject } from '@nestjs/common';
import { EMPTY, Observable, Subscription, catchError, mergeMap, of } from 'rxjs';

import { Logger } from '@evelbulgroz/logger';

import LogLevel from './models/log-level.enum';
import UnifiedLogEntry from './models/unified-log-event.model';
import StreamMapper from './models/stream-mapper.model';

/** MergedStreamLogger provides a centralized way to process multiple observable streams 
 * into a unified logging mechanism using registered stream mappers.
 * 
 * This service allows components to register their various event streams (logs$, state$, etc.)
 * and have them automatically mapped to appropriate log entries and sent to the application logger.
 * 
 * ## Features
 * - Unified handling of different event types
 * - Stream transformation via specialized mappers
 * - Automatic subscription management
 * - Component-level isolation of subscriptions
 * 
 * ## Usage Examples
 * 
 * ### Basic Repository Usage
 * ```typescript
 * @Injectable()
 * export class UserRepository extends ManagedStatefulComponentMixin(Repository) {
 *   constructor(
 *     protected readonly streamLogger: MergedStreamLogger,
 *     // other dependencies
 *   ) {
 *     super();
 *     this.setupLogging();
 *   }
 * 
 *   protected setupLogging(): void {
 *     // Register both logs$ and state$ streams with the logger
 *     this.streamLogger.subscribeToStreams(
 *       {
 *         logs$: this.logs$,
 *         state$: this.state$
 *       },
 *       this.constructor.name // Used as context in logs
 *     );
 *   }
 * 
 *   public override async shutdown(): Promise<void> {
 *     // Unsubscribe this component's streams when shutting down
 *     this.streamLogger.unsubscribeComponent(this.constructor.name);
 *     
 *     // Complete your streams (optional but recommended)
 *     // this.logs$.complete();
 *     
 *     await super.shutdown();
 *   }
 * }
 * ```
 * 
 * ### Component with Custom Subscription Key
 * ```typescript
 * @Injectable()
 * export class DataService implements OnDestroy {
 *   public readonly logs$ = new Subject<LogEntry>();
 *   public readonly state$ = new BehaviorSubject<ComponentStateInfo>({...});
 *   public readonly metrics$ = new Subject<MetricEvent>();
 *   
 *   protected readonly subscriptionKey = `DataService-${Date.now()}`;
 * 
 *   constructor(protected readonly streamLogger: MergedStreamLogger) {
 *     this.initLogging();
 *   }
 * 
 *   protected initLogging(): void {
 *     // Register multiple stream types with a unique subscription key
 *     this.streamLogger.subscribeToStreams(
 *       {
 *         logs$: this.logs$,
 *         state$: this.state$,
 *         metrics$: this.metrics$ // Requires a MetricsMapper to be registered
 *       },
 *       'DataService',     // Context for logs
 *       this.subscriptionKey  // Unique key for subscription management
 *     );
 *   }
 * 
 *   // Clean up when Angular destroys component
 *   ngOnDestroy(): void {
 *     this.streamLogger.unsubscribeComponent(this.subscriptionKey);
 *     this.logs$.complete();
 *     this.state$.complete();
 *     this.metrics$.complete();
 *   }
 * }
 * ```
 * 
 * ### Registering Custom Stream Mappers
 * ```typescript
 * // In your module
 * @Module({
 *   providers: [
 *     LogEntryMapper,
 *     ComponentStateMapper,
 *     MetricsMapper, // Your custom mapper
 *     {
 *       provide: 'STREAM_MAPPERS',
 *       useFactory: (logMapper, stateMapper, metricsMapper) => [
 *         logMapper,
 *         stateMapper,
 *         metricsMapper
 *       ],
 *       inject: [LogEntryMapper, ComponentStateMapper, MetricsMapper]
 *     },
 *     MergedStreamLogger
 *   ],
 *   exports: [MergedStreamLogger]
 * })
 * export class LoggingModule {}
 * ```
 * 
 * ### Manual Registration of Mappers
 * ```typescript
 * // Outside of dependency injection
 * const logger = new Logger();
 * const mergedLogger = new MergedStreamLogger(logger);
 * 
 * // Register mappers manually
 * mergedLogger.registerMapper(new LogEntryMapper());
 * mergedLogger.registerMapper(new ComponentStateMapper());
 * ```
 * 
 * @see StreamMapper for information on creating custom stream mappers
 */
@Injectable()
export class MergedStreamLogger {
	// Map components to their subscriptions
	protected componentSubscriptions: Map<string, Subscription[]> = new Map();
	protected mappers: Map<string, StreamMapper<any>> = new Map();

	// Failure tracking properties
	protected streamFailureCounts: Map<string, number> = new Map();
	protected streamBackoffTimers: Map<string, any> = new Map();
	protected readonly MAX_FAILURES = 5;
	protected readonly BACKOFF_RESET_MS = 60000; // 1 minute

	constructor(
		protected readonly logger: Logger,
		@Optional() @Inject('STREAM_MAPPERS') mappers?: StreamMapper<any>[]
	) {
		// Register all provided mappers
		if (mappers) {
			mappers.forEach(mapper => this.registerMapper(mapper));
		}
	}

	/** Manually register a stream mapper for a specific stream type
	 * @param mapper The mapper to register for a named stream type
	 * @see StreamMapper for more information on creating custom mappers
	 * @remark This is useful for registering mappers that are not automatically injected, e.g. in tests or custom modules.
	 */
	public registerMapper(mapper: StreamMapper<any>): void {
		this.mappers.set(mapper.streamType, mapper);
	}

	/** Register component streams the logger should listen to
	 * @param streams Object containing named observable streams to process
	 * @param context Optional component name for context
	 * @param subscriptionKey Optional key to identify this subscription group
	 * @remark This method subscribes to the provided streams and processes their events using the registered mappers.
	 * @remark If a mapper is not found for a stream type, a warning is logged and the stream is ignored.
	 * @remark If an error occurs during mapping, it is logged and the stream continues to be monitored.
	 * @remark Streams with repeated failures will have reduced error logging to avoid log spamming.
	 */
	public subscribeToStreams(
		streams: Record<string, Observable<any>>,
		context?: string,
		subscriptionKey?: string
	): void {
		const key = subscriptionKey || context || `anonymous-${Date.now()}`;
		
		// Subscribe to each stream individually
		Object.entries(streams).forEach(([streamType, stream$]) => {
			if (!stream$) return;
	
			const mapper = this.mappers.get(streamType);			
			if (mapper) {
				// Track failures for this stream
				const streamKey = `${key}:${streamType}`;
				if (!this.streamFailureCounts.has(streamKey)) {
					this.streamFailureCounts.set(streamKey, 0);
				}
	
				// Define a function to handle mapping an event with built-in error handling
				const processEvent = (event: any) => {
					try {
						// Try to map the event
						const result = mapper.mapToLogEvents(of(event), context);
						
						// Reset failure count on success
						if (this.streamFailureCounts.get(streamKey)! > 0) {
							this.handleStreamRecovery(streamKey, streamType);
						}
						
						return result;
					} catch (error) {
						// Increment and track failure count
						this.handleStreamError(streamKey, streamType, error);
						
						// Return empty observable for this event only
						return EMPTY;
					}
				};
	
				// Create a subscription for this specific stream
				const subscription = stream$
					.pipe(
						// Handle source stream errors first
						catchError(error => {
							this.logger.error(
								`Stream "${streamType}" emitted an error: ${error.message}`, 
								error, 
								this.constructor.name
							);
							
							// Return empty to complete this stream but allow others to continue
							return EMPTY;
						}),
						// For each event, properly handle errors at the event level
						mergeMap(event => {
							return processEvent(event).pipe(
								// Catch errors at the individual mapped event level
								catchError(error => {
									this.handleStreamError(streamKey, streamType, error);
									return EMPTY; // Skip just this event
								})
							);
						})
					)
					.subscribe(event => {
						this.processLogEntry(event);
					});
				
				// Store subscription with key for targeted cleanup
				if (!this.componentSubscriptions.has(key)) {
					this.componentSubscriptions.set(key, []);
				}
				this.componentSubscriptions.get(key)?.push(subscription);
			} else {
				// Log a warning if no mapper is found for this stream type
				this.logger.warn(
					`No mapper registered for stream type "${streamType}"`, 
					this.constructor.name
				);
			}
		});
	}

	/** Handle stream error with failure counting and backoff
	 * @param streamKey Unique key for the stream (component:streamType)
	 * @param streamType Type of stream that failed
	 * @param error The error that occurred
	 */
	protected handleStreamError(streamKey: string, streamType: string, error: any): void {
		// Increment failure count
		const failures = this.streamFailureCounts.get(streamKey)! + 1;
		this.streamFailureCounts.set(streamKey, failures);
		
		// Set up automatic recovery timer if not already set
		if (!this.streamBackoffTimers.has(streamKey)) {
			this.streamBackoffTimers.set(streamKey, setTimeout(() => {
				// Reset failure count after timeout period
				if (this.streamFailureCounts.has(streamKey)) {
					this.streamFailureCounts.set(streamKey, 0);
					this.logger.debug(
						`Failure count automatically reset for stream '${streamType}' after ${this.BACKOFF_RESET_MS}ms`,
						this.constructor.name
					);
				}
				this.streamBackoffTimers.delete(streamKey);
			}, this.BACKOFF_RESET_MS));
		}
		
		// Log based on failure count
		if (failures <= this.MAX_FAILURES) {
			// Log every error until we reach the threshold
			this.logger.error(
				`Error in stream mapper for '${streamType}' (failure ${failures}/${this.MAX_FAILURES}): ${error?.message || 'Unknown error'}`,
				error,
				this.constructor.name
			);
			
			// Only log the continuation message for early failures to avoid spam
			if (failures <= 2) {
				this.logger.info(
					`Monitoring for ${streamType} continues despite mapping error`,
					this.constructor.name
				);
			}
		} else if (failures === this.MAX_FAILURES + 1) {
			// When we cross the threshold, log one warning about reduced logging
			this.logger.warn(
				`Stream "${streamType}" has failed ${failures} times, reducing error logging frequency`,
				this.constructor.name
			);
		} else if (failures % 10 === 0) {
			// Log only occasionally after that (every 10 failures)
			this.logger.warn(
				`Stream "${streamType}" continues to fail: ${failures} total failures`,
				this.constructor.name
			);
		}
	}

	/** Handle recovery from stream errors
	 * @param streamKey Unique key for the stream
	 * @param streamType Type of stream that recovered
	 */
	protected handleStreamRecovery(streamKey: string, streamType: string): void {
		const previousFailures = this.streamFailureCounts.get(streamKey) || 0;
		
		// Reset failure count
		this.streamFailureCounts.set(streamKey, 0);
		
		// Clear any existing backoff timer
		if (this.streamBackoffTimers.has(streamKey)) {
			clearTimeout(this.streamBackoffTimers.get(streamKey));
			this.streamBackoffTimers.delete(streamKey);
		}
		
		// Log recovery if there were significant failures
		if (previousFailures >= 3) {
			this.logger.info(
				`Stream "${streamType}" has recovered after ${previousFailures} failures`,
				this.constructor.name
			);
		}
	}

	/** Unsubscribe all subscriptions for a specific component
	 * @param key The subscription key or context to unsubscribe
	 * @returns true if subscriptions were found and unsubscribed, false otherwise
	 * @remark This is useful for properly cleaning up subscriptions when a component is destroyed or no longer needs logging.
	 */
	public unsubscribeComponent(key: string): boolean {
		const subscriptions = this.componentSubscriptions.get(key);
		
		if (!subscriptions || subscriptions.length === 0) {
			return false;
		}
		
		// Unsubscribe all subscriptions for this component
		subscriptions.forEach(subscription => {
			subscription.unsubscribe();
		});
		
		// Clear the component's subscriptions
		this.componentSubscriptions.delete(key);
		
		return true;
	}

	/** Clean up all subscriptions */
	public unsubscribeAll(): void {
		this.componentSubscriptions.forEach(subscriptions => {
			subscriptions.forEach(sub => sub?.unsubscribe());
		});
		this.componentSubscriptions.clear();
	}

	/** Log unified log event using the concrete logger set at construction */
	protected processLogEntry(entry: UnifiedLogEntry): void {
		switch (entry.level) {
			case LogLevel.ERROR:
				this.logger.error(entry.message, entry.data, entry.context);
				break;
			case LogLevel.WARN:
				this.logger.warn(entry.message, entry.context);
				break;
			case LogLevel.INFO:
				this.logger.info(entry.message, entry.context);
				break;
			case LogLevel.DEBUG:
				this.logger.debug(entry.message, entry.context);
				break;
			case LogLevel.VERBOSE:
				this.logger.verbose(
					`${entry.message}${entry.data ? `, ${JSON.stringify(entry.data)}` : ''}`, 
					entry.context
				);
				break;
			case LogLevel.LOG:
			default:
				this.logger.log(entry.message, entry.context);
				break;
		}
	}
}