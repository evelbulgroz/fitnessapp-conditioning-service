/** Enum specifying supported log levels.
 * @remark Used to categorize log messages by severity or importance (ordered from least to most severe).
 * @remark Values are lower case to facilitate dynamic lookup of log level in the logger.
 */

export enum LogLevel {
	/** Standard log level. Used for general log messages that do not fall into any other category. */
	LOG = 'log',

	/** Log level for warning messages. Used for messages that indicate a potential problem or issue. */
	WARN = 'warn',

	/** Log level for error messages. Used for messages that indicate an error or failure. */
	ERROR = 'error',

	/** Log level for informational messages. Used for messages that provide general information about the application. */
	INFO = 'info',

	/** Log level for debugging messages. Used for messages that help with debugging the application during development. */
	DEBUG = 'debug',

	/** Log level for verbose messages. Used for highly detailed information about the application's internal state. */
	VERBOSE = 'verbose'
}
export default LogLevel;