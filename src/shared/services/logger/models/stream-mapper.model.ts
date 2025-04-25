import { Observable } from 'rxjs';
import UnifiedLogEntry from './unified-log-event.model';

export interface StreamMapper<T> {
	readonly streamType: string;
	mapToLogEvents(source$: Observable<T>, context?: string): Observable<UnifiedLogEntry>;
}
export default StreamMapper;