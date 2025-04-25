import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LogEntry as RepoLogEntry } from '@evelbulgroz/ddd-base';

import LogEventSource from '../models/log-event-source.model';
import StreamMapper from '../models/stream-mapper.model';
import UnifiedLogEntry from '../models/unified-log-event.model';

@Injectable()
export class RepoLogMapper implements StreamMapper<RepoLogEntry> {
	public readonly streamType = 'logs$';
	
	public mapToLogEvents(
		source$: Observable<RepoLogEntry>,
		context?: string
	): Observable<UnifiedLogEntry> {
		return source$.pipe(
			map((log: RepoLogEntry): UnifiedLogEntry => ({
				source: LogEventSource.LOG,
				timestamp: new Date(),
				level: log.level,
				message: log.message,
				context: log.context || context,
				data: log.data
			}))
		);
	}
}