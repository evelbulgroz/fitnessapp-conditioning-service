import { Subject } from "rxjs";

import LogLevel from "./log-level.enum";
import UnifiedLogEntry from "./unified-log-event.model";

/** Specifies the interface for a loggable component. */
export interface LoggableComponent {
	/** Observable stream of log entries */
	readonly log$: Subject<UnifiedLogEntry>;

	/** Log a message with the specified level to the log stream.
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
	log(level: LogLevel, message: string, data?: any, context?: string): void;
};
export default LoggableComponent;