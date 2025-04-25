import { LogLevel } from './log-level.enum';
import LogEventSource from './log-event-source.model';

/** A unified log entry structure for different event types */
export interface UnifiedLogEntry {
	/** The source of the log entry (e.g. LogEventSource.LOG, LogEventSource.STATE, etc.). */
	source: LogEventSource;
		
	/** The log level of the entry. */
	level: LogLevel;

	/** The message of the log entry. */
	message: string;

	/** The context of the log entry, e.g. name of the class or method that generated it. */
	context?: string;

	/** The timestamp of the log entry (in ISO format, auto-set by the log source). */
	timestamp: Date;
	
	/** Any data payload associated with the log entry (optional). */
	data?: any;
}

export default UnifiedLogEntry;