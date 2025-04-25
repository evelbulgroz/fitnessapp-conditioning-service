import { Injectable, Optional, Inject } from '@nestjs/common';
import { Observable, Subscription, merge } from 'rxjs';

import { Logger } from '@evelbulgroz/logger';

import LogLevel from './models/log-level.enum';
import UnifiedLogEntry from './models/unified-log-event.model';
import StreamMapper from './models/stream-mapper.model';

/**
 * MergedStreamLogger provides a centralized way to process multiple observable streams 
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
 *     private readonly streamLogger: MergedStreamLogger,
 *     // other dependencies
 *   ) {
 *     super();
 *     this.setupLogging();
 *   }
 * 
 *   private setupLogging(): void {
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
 *   private readonly subscriptionKey = `DataService-${Date.now()}`;
 * 
 *   constructor(private readonly streamLogger: MergedStreamLogger) {
 *     this.initLogging();
 *   }
 * 
 *   private initLogging(): void {
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
	private componentSubscriptions: Map<string, Subscription[]> = new Map();
	private mappers: Map<string, StreamMapper<any>> = new Map();

	constructor(
		private readonly logger: Logger,
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
	 */
	public subscribeToStreams(
		streams: Record<string, Observable<any>>,
		context?: string,
		subscriptionKey?: string
	): void {
		const key = subscriptionKey || context || `anonymous-${Date.now()}`;
		const mappedStreams: Observable<UnifiedLogEntry>[] = [];

		// Process each stream using its registered mapper
		Object.entries(streams).forEach(([streamType, stream$]) => {
			if (!stream$) return;

			const mapper = this.mappers.get(streamType);
			
			if (mapper) {
				// Map the stream using the registered mapper
				const mappedStream$ = mapper.mapToLogEvents(stream$, context);
				mappedStreams.push(mappedStream$);
			} else {
				// Log a warning if no mapper is found for this stream type
				this.logger.warn(
					`No mapper registered for stream type "${streamType}"`, 
					this.constructor.name
				);
			}
		});

		// Merge all streams and subscribe if we have any
		if (mappedStreams.length > 0) {
			const subscription = merge(...mappedStreams).subscribe(event => {
				this.processLogEntry(event);
			});
			
			// Store subscription with key for targeted cleanup
			if (!this.componentSubscriptions.has(key)) {
				this.componentSubscriptions.set(key, []);
			}
			this.componentSubscriptions.get(key)?.push(subscription);
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