import { Subject } from 'rxjs';

import LoggableComponent from '../models/loggable-component.model';
import LogEventSource from '../models/log-event-source.model';
import LogLevel from '../models/log-level.enum';
import UnifiedLogEntry from '../models/unified-log-event.model';

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
 export function LoggableMixin<TParent extends new (...args: any[]) => any>(Base: TParent) {
	return class Loggable extends Base implements LoggableComponent {
		public readonly log$ = new Subject<UnifiedLogEntry>();

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