import { map, Observable } from 'rxjs';

import LogEventSource from '../../../../models/log-event-source.model';
import LogLevel from '../../../../models/log-level.enum';
import RepoLogEntry from './repo-log-entry.model'
import RepoLogLevel from './repo-log-level.enum';
import StreamMapper from '../../models/stream-mapper.model';
import UnifiedLogEntry from '../../../../models/unified-log-event.model';

/** Sample implementation of a stream mapper converting repository state events into unified log entries.
 * @remark This is a sample implementation for demonstration purposes only.
 * @remark To avoid external dependencies, it is not exported from this library.
 * @remark Library consumers should implement their own mappers for their specific use cases.
*/
export class RepoLogMapper implements StreamMapper<RepoLogEntry> {
	public readonly streamType = 'repoLog$';
	
	public mapToLogEvents(
		source$: Observable<RepoLogEntry>,
		context?: string
	): Observable<UnifiedLogEntry> {
		return source$.pipe(
			map((log: RepoLogEntry): UnifiedLogEntry => ({
				source: LogEventSource.LOG,
				timestamp: log.timestamp || new Date(),
				level: this.mapRepoLevelToLogLevel(log.level),
				message: log.message,
				context: log.context || context,
				data: log.data
			}))
		);
	}

	/* This method maps the repository log level to the unified log level.
	 * @param level - The log level from the repository.
	 * @returns The corresponding unified log level, or LOG if the level is unknown.
	 * @remark May seem redundant, but coupling repository repo log level tightly to the unified log level.
	 * @remark This allows for future changes in the repository log level without affecting the unified log level.
	 */
	protected mapRepoLevelToLogLevel(level: RepoLogLevel): LogLevel {
		switch (level) {
			case RepoLogLevel.ERROR:
				return LogLevel.ERROR;
			case RepoLogLevel.WARN:
				return LogLevel.WARN;
			case RepoLogLevel.INFO:
				return LogLevel.INFO;
			case RepoLogLevel.DEBUG:
				return LogLevel.DEBUG;
			case RepoLogLevel.VERBOSE:
				return LogLevel.VERBOSE;
			default:
				return LogLevel.LOG;
		}
	}
}
export default RepoLogMapper;