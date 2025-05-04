import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { LogEventSource, StreamMapper, UnifiedLogEntry } from '../../libraries/stream-loggable';

/** Maps log streams of type UnifiedLogEntry unchanged to the unified log format.
 * 
 * This is a pass-through mapper that doesn't transform the entries, but ensures
 * the context is properly set if provided.
 */
@Injectable()
export class LogMapper extends StreamMapper<UnifiedLogEntry> {
	public readonly streamType = 'log$';
	
	/** Maps UnifiedLogEntry directly to UnifiedLogEntry, setting context if provided
	 * @param source$ - The source observable of UnifiedLogEntry objects
	 * @param context - Optional context to apply if the entry doesn't already have one
	 * @returns Observable of UnifiedLogEntry objects
	 */
	public mapToLogEvents(
		source$: Observable<UnifiedLogEntry>,
		context?: string
	): Observable<UnifiedLogEntry> {
		return source$.pipe(
			map((logEntry: UnifiedLogEntry): UnifiedLogEntry => ({
				...logEntry,
				source: logEntry.source || LogEventSource.LOG,
				context: logEntry.context || context,
				timestamp: logEntry.timestamp || new Date()
			}))
		);
	}
}

export default LogMapper;