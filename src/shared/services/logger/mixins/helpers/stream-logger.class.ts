import LogLevel from "../../models/log-level.enum";
import LoggableComponent from "../../models/loggable-component.model";
import Logger from "../../models/logger.model";

/** Logger that logs messages to the `log$` observable stream of a {@link LoggableComponent} instance.
 * @remark Syntax sugar providing a familiar interface to the `logToStream()` method of the {@link LoggableComponent} class.
 * @remark Intended for composition into {@link LoggableMixin}. Not intended for direct use by other classes.
 * @see {@link LoggableComponent} for details on the `log$` observable stream.
 * @see {@link LoggableMixin} for details on the mixin that adds logging capabilities to any class.
 * @todo Consider adding log level filtering to the logger to control which messages are logged based on the log level.
*/
export class StreamLogger extends Logger {
	/* The {@link LoggableComponent} log source from which to stream log messages. */
	protected readonly logSource: LoggableComponent;
	
	/** Constructor for the StreamLogger class.
	 * @param logSource The {@link LoggableComponent} instance to log messages to.
	 * @remarks The log source must implement the {@link LoggableComponent} interface.
	 */
	public constructor(logSource: LoggableComponent) {
		super();
		this.logSource = logSource;
	}
	public error(message: string, trace?: string | Error, context?: string): void {
		this.logSource.logToStream(LogLevel.ERROR, message, trace, context);
	}

	public warn(message: string, context?: string): void {
		this.logSource.logToStream(LogLevel.WARN, message, context);
	}
	
	public info(message: string, context?: string): void {
		this.logSource.logToStream(LogLevel.INFO, message, context);
	}

	public debug(message: string, context?: string): void {
		this.logSource.logToStream(LogLevel.DEBUG, message, context);
	}
	
	public verbose(message: string, context?: string): void {
		this.logSource.logToStream(LogLevel.VERBOSE, message, context);
	}

	public log(message: string, context?: string): void {
		this.logSource.logToStream(LogLevel.LOG, message, context);
	}	
}
export default StreamLogger;