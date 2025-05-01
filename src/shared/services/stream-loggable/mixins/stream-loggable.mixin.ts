import { Subject } from 'rxjs';

import StreamLoggable from '../models/stream-loggable.model'
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
 * class MyService extends StreamLoggableMixin(BaseClass) {
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
 export function StreamLoggableMixin<TParent extends new (...args: any[]) => any>(Base: TParent) {
	return class Loggable extends Base implements StreamLoggable {
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

export default StreamLoggableMixin;

/* Decorator that applies the StreamLoggableMixin to a class to add logging capabilities.
 * @see {@link StreamLoggableMixin} for details on the mixin.
 * @returns A decorator function that applies the StreamLoggableMixin to the decorated class
 * @remark This decorator is a shorthand for applying the StreamLoggableMixin to a class.
 * @remark Any inheritance of the decorated class is preserved with no changes to the class hierarchy or 'extends' syntax.
 * @remark It may be useful to add {@link StreamLoggable} to the list of implemented interfaces in the decorated class.
 * @todo Enable this decorator when TypeScript supports it. Currently, it is commented out to avoid compilation errors.
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
	return function <T extends new (...args: any[]) => any>(target: T): T & (new (...args: any[]) => StreamLoggable) {
		return StreamLoggableMixin(target) as T & (new (...args: any[]) => StreamLoggable);
	};
}
export default WithLogging;
*/