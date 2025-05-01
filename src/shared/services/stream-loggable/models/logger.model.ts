/** Minimal public API for concrete logger expected by MergedStreamLogger.
 * @remark Mimicks commonly used logger interfaces in the Node.js ecosystem, such as Winston and Bunyan or even the NestJS logger.
 * @remark Defines the standard logging methods/levels (error, warn, info, debug, verbose) that should be implemented by any logger.
 * @remark Log levels are listed in severity order, meaning that if you set the log level to `warn`, the logger should log `error` and `warn` messages, but not `info`, `debug`, or `verbose` messages.
 * @remark The `log` method is a standard log level that can be used for general logging purposes, and is typically always active regardless of the configured log level.
 * @remark Concrete loggers should implement these methods to provide specific logging functionality, such as console logging, file logging, or remote logging.
 * @remark Intended for use as interface but implemented as abstract class to support dependency injection in TypeScript frameworks, e.g. NestJS.
 */
export abstract class Logger {
	/** Log level for error messages. Used for messages that indicate an error or failure.
	 * @param message The message to log.
	 * @param trace The stack trace of the error (string or Error object, optional).
	 * @param context The context of the log message (optional).
	 * @remark The trace is used to provide additional information about the error, e.g. the stack trace of the error.
	 */
	abstract error(message: string, trace?: string | Error, context?: string): void;

	/** Log level for warning messages. Used for messages that indicate a potential problem or issue.
	 * @param message The message to log.
	 * @param context The context of the log message (optional).
	 */	
	abstract warn(message: string, context?: string): void;
	
	/** Log level for informational messages. Used for messages that provide general information about the application.
	 * @param message The message to log.
	 * @param context The context of the log message (optional).
	 */
	abstract info(message: string, context?: string): void;

	/** Log level for debugging messages. Used for messages that help with debugging the application during development.
	 * @param message The message to log.
	 * @param context The context of the log message (optional).
	 */
	abstract debug(message: string, context?: string): void;
	
	/** Log level for verbose messages. Used for highly detailed information about the application's internal state.
	 * @param message The message to log.
	 * @param context The context of the log message (optional).
	 * @remark These logs are typically used during development or debugging to trace the flow of execution or inspect complex operations.
	 * @remark Verbose logs should not be enabled in production environments unless troubleshooting specific issues.
	 */
	abstract verbose(message: string, context?: string): void;

	/** Standard log level. Used for general log messages that do not fall into any other category.
	 * @param message The message to log.
	 * @param context The context of the log message (optional).
	 * @remark Unlike other logging methods, log() is typically always active regardless of the configured log level.
	 * @remark Use this method for messages that should always be logged, or that don't fit the severity hierarchy.
	*/
	abstract log(message: string, context?: string): void;	
}
export default Logger;