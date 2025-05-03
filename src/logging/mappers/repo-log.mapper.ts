import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RepoLogEntry, RepoLogLevel } from '@evelbulgroz/ddd-base';

import { LogEventSource, LogLevel, StreamMapper, UnifiedLogEntry} from '../../libraries/stream-loggable';

@Injectable()
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
			case RepoLogLevel.LOG:
				return LogLevel.INFO; // Keep this until base class becomes more disciplined in using log levels.
			default:
				return LogLevel.INFO;
		}
	}
}
export default RepoLogMapper;