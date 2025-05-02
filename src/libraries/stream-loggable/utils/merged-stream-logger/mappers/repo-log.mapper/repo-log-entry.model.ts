import RepoLogLevel from "./repo-log-level.enum";

/** Properties of a log entry
 * @remark This interface is only provided for demonstration purposes.
 * @remark To avoid external dependencies, it is not exported from this library.
 */
export interface RepoLogEntry {
	/** The log level of the entry. */
	level: RepoLogLevel;
	/** The message of the log entry. */
	message: string;
	/** The context of the log entry, e.g. name of the class or method that generated it. */
	context?: string;
	/** The timestamp of the log entry (auto-set by the log source). */
	timestamp: Date;
	/** The sequence number of the log entry (auto-set by the log source).
	 * @remark Used to ensure that log entries can be analyzed and/or processed in the order they were created.
	 * @remark This is useful for debugging and troubleshooting purposes, as it allows developers to see the
	 *   sequence of events that led to a particular state in the application.
	*/
	sequence: number;
	/** Any data associated with the log entry (optional). */
	data?: any;
}
export default RepoLogEntry;