import { map, Observable } from 'rxjs';

import ComponentStateDemo from './component-state.enum';
import ComponentStateInfo from './component-state-info.model';
import LogEventSource from '../../../../models/log-event-source.model';
import LogLevel from '../../../../models/log-level.enum';
import StreamMapper from '../../models/stream-mapper.model';
import UnifiedLogEntry from '../../../../models/unified-log-event.model';

/** Sample implementation of a stream mapper converting component state events into unified log entries.
 * @remark This is a sample implementation for demonstration purposes only.
 * @remark To avoid external dependencies, it is not exported from this library.
 * @remark Library consumers should implement their own mappers for their specific use cases.
*/
export class ComponentStateMapper implements StreamMapper<ComponentStateInfo> {
public readonly streamType = 'componentState$';
	
	public mapToLogEvents(
		source$: Observable<ComponentStateInfo>,
		context?: string
	): Observable<UnifiedLogEntry> {
		return source$.pipe(
			map((state: ComponentStateInfo): UnifiedLogEntry => ({
				source: LogEventSource.STATE,
				timestamp: state.updatedOn || new Date(),
				level: this.mapStateToLogLevel(state.state),
				message: `State changed to ${state.state}: ${state.reason}`,
				context: state.name || context,
				data: state
			}))
		);
	}
	
	protected mapStateToLogLevel(state: ComponentStateDemo): LogLevel {
		switch (state) {
			case ComponentStateDemo.FAILED:
				return LogLevel.ERROR;
			case ComponentStateDemo.DEGRADED:
				return LogLevel.WARN;			
			// Most other states are INFO, but we can be more specific if needed.
			default:
				return LogLevel.INFO;
		}
	}
}
export default ComponentStateMapper;