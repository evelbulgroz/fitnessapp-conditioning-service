import { Subject } from 'rxjs';

import LogEventSource from '../models/log-event-source.model';
import LogLevel from '../models/log-level.enum';
import UnifiedLogEntry from '../models/unified-log-event.model';

/** Type for the constructor of any class that can be extended by the LoggableMixin */
export type Constructor<T = {}> = new (...args: any[]) => T;

/** Mixin that adds logging capabilities to any class via a log$ observable stream.
 * @param Base The class to extend with logging capabilities
 * @returns A new class with logging capabilities
 * 
 * @example
 * ```typescript
 * class MyService extends LoggableMixin(BaseClass) {
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
export function LoggableMixin<TBase extends Constructor>(Base: TBase) {
	return class Loggable extends Base {
		/** Observable stream of log entries */
		public readonly log$ = new Subject<UnifiedLogEntry>();

		/** Log a message with the specified level 
		 * @param level The log level
		 * @param message The message to log
		 * @param data Optional data to include with the log
		 * @param context Optional context for the log (defaults to class name)
		 * @remark Use the logLevel param to specify the log level rather than using the info, warn, error methods directly.
		 * @example
		 * ```typescript
		 * this.log(LogLevel.INFO, 'Info message', { data: 'example' });
		 * this.log(LogLevel.WARN, 'Warning message', { data: 'example' });
		 * this.log(LogLevel.ERROR, 'Error message', new Error('Test error'));
		 * ```
		 */
		public log(level: LogLevel, message: string, data?: any, context?: string): void {
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

export default LoggableMixin;