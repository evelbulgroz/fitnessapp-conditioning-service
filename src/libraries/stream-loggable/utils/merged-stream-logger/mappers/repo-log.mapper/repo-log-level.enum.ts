/** Enum specifying supported log levels.
 * @remark This enum is only provided for demonstration purposes.
 * @remark To avoid external dependencies, it is not exported from this library.
 */
export enum RepoLogLevel {
    /** Standard log level. Used for general log messages that do not fall into any other category. */
    LOG = "log",
    /** Log level for warning messages. Used for messages that indicate a potential problem or issue. */
    WARN = "warn",
    /** Log level for error messages. Used for messages that indicate an error or failure. */
    ERROR = "error",
    /** Log level for informational messages. Used for messages that provide general information about the application. */
    INFO = "info",
    /** Log level for debugging messages. Used for messages that help with debugging the application during development. */
    DEBUG = "debug",
    /** Log level for verbose messages. Used for highly detailed information about the application's internal state. */
    VERBOSE = "verbose"
}
export default RepoLogLevel;