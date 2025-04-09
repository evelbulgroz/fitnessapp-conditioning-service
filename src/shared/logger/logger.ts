export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Abstract base class for loggers mimicking the NestJS logger interface without introducing a dependency on NestJS.
 * @remark This class is abstract and cannot be instantiated directly. Subclasses must implement all abstract methods.
 * @remark This class defines the standard logging methods (`log`, `warn`, `error`, `info`, `debug`, `verbose`) and their intended use.
 * @remark Subclasses should implement these methods to provide specific logging functionality, such as console logging, file logging, or remote logging.
 * @remark The `logLevel` property determines which messages are logged based on their severity.
 * @remark Implemented as an abstract class b/c to enable use with dependency injection, which does not support interfaces in TypeScript.
 */
export abstract class Logger {
	//------------------------------ PROPERTIES -----------------------------//

	/* The name of the application, used for logging messages.
	 * @remark This property is used to identify the app or library level source of the log message.
	 * @remark This is distinct from the context, which is used to provide component or service level information.
	 */
	protected appName: string;

    /* The default context of the logger, used for logging messages.
     * @remark Overridden by any context passed to a specific log method.
     */
	protected context?: string;

    /* The log level of the logger, used to determine which messages to log (default is 'debug').
     * @remark Valid values are 'error', 'warn', 'info', 'debug', and 'verbose', in order of increasing verbosity.
     * @remark Only messages with a severity level equal to or higher than the `logLevel` will be logged.
     */
    protected logLevel: LogLevel;

	//------------------------------ CONSTRUCTOR ----------------------------//
	
	/** Constructor for the Logger class.
     * @param context The default context of the logger (optional).
     * @param logLevel The log level of the logger (default is 'debug').
	 * @param appName The name of the application (default is 'App').
     * @remark The context is used to provide additional information about the source of the log message, e.g. the name of the module or service.
     * @remark The context is overridden by any context passed to a specific log method.
     * @remark The log level can be set to severity levels of 'verbose', 'debug', 'log', 'info', 'warn', or 'error'.
     * @remark The log level determines which messages are logged based on their severity.
     * @remark The default log level is 'debug', which logs all messages except those with a 'verbose' severity.
     *  @remark Only messages with a severity level equal to or higher than the log level will be logged.
     * @remark The default log level is 'debug', which logs all non-verbose messages.
     */ 
    constructor(
		logLevel: LogLevel = 'debug',
		appName: string = 'App',
		context?: string,
		
	) {
		this.appName = appName;
		this.logLevel = logLevel;
		this.context = context;		
	}

	//------------------------------ PUBLIC API -----------------------------//

	/** Standard log level. Used for general log messages that do not fall into any other category.
     * @param message The message to log.
     * @param context The context of the log message (optional).
     * @remark See the constructor comments for details on how the context is used.
     */
    abstract log(message: string, context?: string): void;

    /** Log level for warning messages. Used for messages that indicate a potential problem or issue.
     * @param message The message to log.
     * @param context The context of the log message (optional).
     * @remark See the constructor comments for details on how the context is used.
     */
	abstract warn(message: string, context?: string): void;

    /** Log level for error messages. Used for messages that indicate an error or failure.
     * @param message The message to log.
     * @param trace The stack trace of the error (optional).
     * @param context The context of the log message (optional).
     * @remark The trace is used to provide additional information about the error, e.g. the stack trace of the error.
     * @remark See the constructor comments for details on how the context is used.
     */
	abstract error(message: string, trace?: string, context?: string): void;

    /** Log level for informational messages. Used for messages that provide general information about the application.
     * @param message The message to log.
     * @param context The context of the log message (optional).
     * @remark See the constructor comments for details on how the context is used.
     */
	abstract info(message: string, context?: string): void;

    /** Log level for debugging messages. Used for messages that help with debugging the application during development.
     * @param message The message to log.
     * @param context The context of the log message (optional).
     * @remark See the constructor comments for details on how the context is used.
     */
	abstract debug(message: string, context?: string): void;

    /** Log level for verbose messages. Used for highly detailed information about the application's internal state.
     * @param message The message to log.
     * @param context The context of the log message (optional).
     * @remark See the constructor comments for details on how the context is used.
     * @remark These logs are typically used during development or debugging to trace the flow of execution or inspect complex operations.
     * @remark Verbose logs should not be enabled in production environments unless troubleshooting specific issues.
     */
	abstract verbose(message: string, context?: string): void;

	//---------------------- PROTECTED METHODS (DEFAULTS) ---------------------//

	/* Get the current timestamp in ISO format.
	 * @returns The current timestamp as a string.
	 */
	protected getTimestamp(): string {
		return new Date().toISOString();
	}

	/* Check if the log level is enabled for the current message.
	 * @param level The log level to check.
	 * @returns true if the log level is enabled, false otherwise.
	 */
	protected shouldLog(level: string): boolean {
		const levels = ['verbose', 'debug', 'log', 'info', 'warn', 'error'];
		return levels.indexOf(level) >= levels.indexOf(this.logLevel);
	}	
}

export default Logger