import { Subject } from "rxjs";

import LogLevel from "./log-level.enum";
import StreamLogger from "../mixins/helpers/stream-logger.class";
import UnifiedLogEntry from "./unified-log-event.model";

/** Specifies the interface for a loggable component. */
export interface LoggableComponent {
	/** Observable stream of log entries */
	readonly log$: Subject<UnifiedLogEntry>;

	/** Logger instance for the component.
	 * @remark This property enables use of a familiar syntax for logging messages to the `log$` observable stream.
	 * @remark This is optional syntax sugar. Using `logToStream()` directly is equally valid.
	 * @see {@link StreamLogger} for details on the logger implementation.
	 * @see {@link LoggableComponent} for details on the `log$` observable stream.
	 * @example
	 * ```typescript
	 * this.logger.info('Info message', { data: 'example' });
	 * this.logger.warn('Warning message', { data: 'example' });
	 */
	readonly logger: StreamLogger;

	/** Log a message with the specified level to the `log$` stream.
	 * @param level The log level
	 * @param message The message to log
	 * @param data Optional data to include with the log
	 * @param context Optional context for the log (defaults to class name)
	 * @remark Use the logLevel param to specify the log level rather than using the info, warn, error methods directly.
	 * @remark Use this method to log messages directly, or optionally use the `logger` property for a more familiar syntax.
	 * @example
	 * ```typescript
	 * this.log(LogLevel.INFO, 'Info message', { data: 'example' }, updatedOn: '2023-10-01T00:00:00Z', context: 'MyComponent');
	 * this.log(LogLevel.WARN, 'Warning message', { data: 'example' }, updatedOn: '2023-10-01T00:00:00Z', context: 'MyComponent');
	 * this.log(LogLevel.DEBUG, 'Debug message', { data: 'example' }, updatedOn: '2023-10-01T00:00:00Z', context: 'MyComponent
	 * this.log(LogLevel.ERROR, 'Error message', new Error('Test error'), updatedOn: '2023-10-01T00:00:00Z', context: 'MyComponent');
	 * ```
	 */
	logToStream(level: LogLevel, message: string, data?: any, context?: string): void;
};
export default LoggableComponent;