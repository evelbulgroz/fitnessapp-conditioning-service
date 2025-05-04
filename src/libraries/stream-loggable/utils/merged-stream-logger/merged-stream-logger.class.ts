import { EMPTY, Observable, Subscription, catchError, mergeMap, of } from 'rxjs';

import MergedStreamLoggerOptions from './models/merged-stream-logger-options.model';
import Logger from '../../models/logger.model';
import LogLevel from '../../models/log-level.enum';
import UnifiedLogEntry from '../../models/unified-log-event.model';
import StreamMapper from './models/stream-mapper.model';
import { StreamInfo } from './models/stream-info.model';

/** Unified logger of multiple observable streams using registered stream mappers.
 * @remark This class provides a centralized way to process multiple observable streams 
 * into a unified logging mechanism using registered stream mappers.
 * 
 * @remark It allows components to register their various event streams (logs$, componentState$, etc.)
 * and have them automatically mapped to appropriate log entries and sent to the application logger.
 * 
 * ## FEATURES
 * - Unified handling of different event types
 * - Stream transformation via specialized mappers
 * - Automatic subscription management
 * - Component-level isolation of subscriptions
 * 
 * ## USAGE EXAMPLES
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
 *     // Register both logs$ and componentState$ streams with the logger
 *     this.streamLogger.subscribeToStreams(
 *       {
 *         logs$: this.logs$,
 *         componentState$: this.componentState$
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
 *   public readonly componentState$ = new BehaviorSubject<ComponentStateInfo>({...});
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
 *         componentState$: this.componentState$,
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
 *     this.componentState$.complete();
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
export class MergedStreamLogger {
	//--------------------------------------- PROPERTIES ----------------------------------------//
	
	// Map components to their subscriptions
	protected componentSubscriptions: Map<string, Subscription> = new Map();
	protected mappers: Map<string, StreamMapper<any>> = new Map();

	// Config options for the logger
	protected readonly config: Required<MergedStreamLoggerOptions>;
	// streamTypeConfigs?: Record<string, Partial<MergedStreamLoggerOptions>>; // TODO: Optional per-stream configs

	// Failure tracking properties
	protected streamFailureCounts: Map<string, number> = new Map();
	protected streamBackoffTimers: Map<string, any> = new Map();
	
	//-------------------------------------- CONSTRUCTOR ----------------------------------------//

	constructor(
		readonly logger: Logger,
		mappers?: StreamMapper<any>[],
		options?: MergedStreamLoggerOptions
	) {
		// Merge default options with provided options after validation
		this.config = {
			maxFailures: 5,
			backoffResetMs: 60000,
			logRecoveryEvents: true,
			warnOnMissingMappers: true,
			...(this.validateOptions(options) || {})
		};

		// Register all provided mappers
		if (mappers) {
			mappers.forEach(mapper => this.registerMapper(mapper));
		}
	}

	//--------------------------------------- PUBLIC API ----------------------------------------//

	/** Manually register a stream mapper for a specific stream type
	 * @param mapper The mapper to register for a named stream type
	 * @see StreamMapper for more information on creating custom mappers
	 * @remark This is useful for registering mappers that are not automatically injected, e.g. in tests or custom modules.
	 */
	public registerMapper(mapper: StreamMapper<any>): void {
		this.mappers.set(mapper.streamType, mapper);
	}

	/** Register component streams the logger should listen to
	 * 
	 * @param streams Array of StreamInfo objects containing streams to process
	 * @param customKey Optional custom key for the subscription, defaults to component name
	 *  - Mostly intended for use with anonymous functions or arrow functions where the constructor name is not available.
	 * @returns void
	 * @throws Error if registration or mapping fails (e.g. invalid stream type, missing component, etc.)
	 * 
	 * @remark This method subscribes to the provided streams and processes their events using the registered mappers.
	 * @remark If a mapper is not found for a stream type, a warning is logged and the stream is ignored.
	 * @remark If an error occurs during mapping, it is logged and the stream continues to be monitored.
	 * @remark Streams with repeated failures will have reduced error logging to avoid log spamming.
	 * @todo Consider making more robust against anonymous functions, arrow functions, or components with similar names.
	 * 
	 * @example
	 * ```typescript
	 * const logger = new MergedStreamLogger(new ConsoleLogger());
	 * logger.subscribeToStreams(
	 *   [
	 *     { streamType: 'log$', component },
	 *     { streamType: 'componentState$', component }
	 *   ]
	 * );
	 * ```
	 */
	public subscribeToStreams(
		streams: StreamInfo[],
	): void {
		// Subscribe to each stream individually
		for (const { streamType, component, customKey } of streams) {
			if (!component) {
				this.logger.warn(
					`No component provided for stream type "${streamType}"`, 
					this.constructor.name
				);
				continue;
			}

			// Get stream from component by property name
			const stream$ = component[streamType];    
			if (!stream$ || typeof stream$.subscribe !== 'function') {
				this.logger.warn(
					`No valid observable found at "${streamType}" on component ${component.constructor?.name || 'unknown'}`, 
					this.constructor.name
				);
				continue;
			}
			
			// Get the mapper for this stream type
			const mapper = this.mappers.get(streamType);      
			if (mapper) {
				// Check if the mapper is a valid instance of StreamMapper
				if (!(mapper instanceof StreamMapper)) {
					this.logger.warn(
						`Mapper for stream type "${streamType}" is not a valid StreamMapper`, 
						this.constructor.name
					);
					continue;
				}

				// Get the component name, or use the custom key if provided
				const componentKey = customKey ?? component.constructor?.name;
				if (!componentKey) {
					this.logger.warn(
						`Component name or key not found for stream type "${streamType}"`, 
						this.constructor.name
					);
					continue;
				}

				const streamKey = `${componentKey}:${streamType}`;
				
				// Track failures for this stream
				if (!this.streamFailureCounts.has(streamKey)) {
					this.streamFailureCounts.set(streamKey, 0);
				}
		
				// Define a function to handle mapping an event with built-in error handling
				const processEvent = (event: any) => {
					try {
						// Try to map the event
						const result = mapper.mapToLogEvents(of(event), componentKey); // Pass the component name as context
			
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
					.subscribe((event: any) => {
						this.processLogEntry(event);
					});
				
				// Store subscription using the provided or generated key

				if (!this.componentSubscriptions.has(streamKey)) {
					this.componentSubscriptions.set(streamKey, subscription);
				}				
			}
			else if (this.config.warnOnMissingMappers) {
				this.logger.warn(
					`No mapper registered for stream type "${streamType}"`, 
					this.constructor.name
				);
			}
		}
	}

	/** Unsubscribe all subscriptions for a specific component
	 * @param componentOrKey The component instance to unsubscribe from, or the custom key used for the subscription
	 * @param customKey Optional custom key for the subscription, defaults to component name
	 * @returns true if subscriptions were found and unsubscribed, false otherwise
	 * @remark This is useful for properly cleaning up subscriptions when a component is destroyed or no longer needs logging.
	 */
	public unsubscribeComponent(componentOrKey: any | string): boolean {
		const componentKey = typeof componentOrKey === 'string' ? componentOrKey : componentOrKey.constructor?.name;
		if (!componentKey) {
			this.logger.warn(
				`No component name found for unsubscription`, 
				this.constructor.name
			);
			return false;
		}
		// get the keys in componentSubscriptions that start with the component key
		const streamKeys = Array.from(this.componentSubscriptions.keys()).filter(key => key.startsWith(componentKey));
		if (streamKeys.length === 0) {
			this.logger.warn(
				`No subscriptions found for component "${componentKey}"`, 
				this.constructor.name
			);
			return false;
		}
		// Unsubscribe and clear all subscriptions for this component
		streamKeys.forEach(streamKey => {
			const subscription = this.componentSubscriptions.get(streamKey);
			if (subscription) {
				subscription.unsubscribe();
				this.componentSubscriptions.delete(streamKey);
			}
		});
		
		return true;
	}

	/** Clean up all subscriptions */
	public unsubscribeAll(): void {
		this.componentSubscriptions.forEach(sub => {
			sub?.unsubscribe();
		});
		this.componentSubscriptions.clear();
	}

	//------------------------------------ PROTECTED METHODS ------------------------------------//

	/* Handle stream error with failure counting and backoff
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
						`Failure count automatically reset for stream '${streamType}' after ${this.config.backoffResetMs}ms`,
						this.constructor.name
					);
				}
				this.streamBackoffTimers.delete(streamKey);
			}, this.config.backoffResetMs));
		}
		
		// Log based on failure count
		if (failures <= this.config.maxFailures) {
			// Log every error until we reach the threshold
			this.logger.error(
				`Error in stream mapper for '${streamType}' (failure ${failures}/${this.config.maxFailures}): ${error?.message || 'Unknown error'}`,
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
		} else if (failures === this.config.maxFailures + 1) {
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

	/* Handle recovery from stream errors
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

	/* Log unified log event using the concrete logger set at construction */
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
				this.logger.log(entry.message, entry.context);
				break;
			default:
				this.logger.info(entry.message, entry.context);
				break;
		}
	}

	/* Validates logger options and returns sanitized options
	 * @param options Raw options provided by user
	 * @returns Validated options with any invalid values corrected
	 */
	protected validateOptions(options?: MergedStreamLoggerOptions): MergedStreamLoggerOptions {
		const validatedOptions: MergedStreamLoggerOptions = { ...options };
		
		if (options) {
		// Ensure maxFailures is at least 1
		if (options.maxFailures !== undefined) {
			if (options.maxFailures < 1) {
				this.logger.warn(
					`Invalid maxFailures value: ${options.maxFailures}. Must be at least 1. Using default.`,
					this.constructor.name
				);
				delete validatedOptions.maxFailures;
			}
		}
		
		// Ensure backoffResetMs is reasonable (at least 100ms)
		if (options.backoffResetMs !== undefined) {
			if (options.backoffResetMs < 100) {
				this.logger.warn(
					`Invalid backoffResetMs value: ${options.backoffResetMs}. Must be at least 100ms. Using default.`,
					this.constructor.name
				);
				delete validatedOptions.backoffResetMs;
			}
		}
		
		// No validation needed for boolean options
		}
		
		return validatedOptions;
	}
}
export default MergedStreamLogger;