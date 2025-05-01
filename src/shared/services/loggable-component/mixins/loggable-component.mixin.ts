import { Subject } from 'rxjs';

import LoggableComponent from '../models/loggable-component.model';
import LogEventSource from '../models/log-event-source.model';
import LogLevel from '../models/log-level.enum';
import StreamLogger from './helpers/stream-logger.class';
import UnifiedLogEntry from '../models/unified-log-event.model';

/** Mixin that adds logging capabilities to any class via a log$ observable stream.
 * @param Base The class to extend with logging capabilities
 * @returns A new class with logging capabilities
 * @todo If/when TypeScript supports it, add a decorator to apply this mixin to a class (see below).
 * 
 * @example
 * ```typescript
 * class MyService extends LoggableComponentMixin(BaseClass) {
 *	 public doSomething(): void {
 *		 this.log(LogLevel.INFO, 'Doing something important');
 *		 // ...implementation...
 *		 this.log(LogLevel.DEBUG, 'Operation completed', { result: 'success' });
 *	 }
 * }
 * 
 * // Later, connect to MergedStreamLogger
 * const service = new MyService();
 * mergedStreamLogger.subscribeToStreams({ logs$: service.logs$ }, 'MyService');
 * ```
 * 
 */
 export function LoggableComponentMixin<TParent extends new (...args: any[]) => any>(Base: TParent) {
	return class Loggable extends Base implements LoggableComponent {
		public readonly log$ = new Subject<UnifiedLogEntry>();
		public readonly logger: StreamLogger = new StreamLogger(this);

		public logToStream(level: LogLevel, message: string, data?: any, context?: string): void {
			const entry: UnifiedLogEntry = {
				source: LogEventSource.LOG,
				level,
				message,
				context: context || this.constructor.name,
				timestamp: new Date(),
				data
			};
			
			this.log$.next(entry);
		}
	};
}

export default LoggableComponentMixin;

/* Decorator that applies the LoggableComponentMixin to a class to add logging capabilities.
 * @see {@link LoggableComponentMixin} for details on the mixin.
 * @returns A decorator function that applies the LoggableComponentMixin to the decorated class
 * @remark This decorator is a shorthand for applying the LoggableComponentMixin to a class.
 * @remark Any inheritance of the decorated class is preserved with no changes to the class hierarchy or 'extends' syntax.
 * @remark It may be useful to add {@link LoggableComponent} to the list of implemented interfaces in the decorated class.
 * 
 * @example
 * ```typescript
 * import { WithLogging } from './with-logging.decorator';
 * 
 * @WithLogging()
 * class MyService {
 *   // Service implementation
 * }
 * ```
 */
/*export function WithLogging() {
	return function <T extends new (...args: any[]) => any>(target: T): T & (new (...args: any[]) => LoggableComponent) {
		return LoggableComponentMixin(target) as T & (new (...args: any[]) => LoggableComponent);
	};
}
export default WithLogging;
*/