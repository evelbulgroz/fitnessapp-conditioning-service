import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import ComponentState from '../../../../app-health/models/component-state.enum';
import ComponentStateInfo from '../../../../app-health/models/component-state-info.model';
import LogEventSource from '../models/log-event-source.model';
import LogLevel from '../models/log-level.enum';
import StreamMapper from '../models/stream-mapper.model';
import UnifiedLogEntry from '../models/unified-log-event.model';

@Injectable()
export class ComponentStateMapper implements StreamMapper<ComponentStateInfo> {
	public readonly streamType = 'state$';
	
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
	
	private mapStateToLogLevel(state: ComponentState): LogLevel {
		switch (state) {
			case ComponentState.FAILED:
				return LogLevel.ERROR;
			case ComponentState.DEGRADED:
				return LogLevel.WARN;
			case ComponentState.SHUTTING_DOWN:
			case ComponentState.INITIALIZING:
				return LogLevel.INFO;
			case ComponentState.OK:
				return LogLevel.LOG;
			default:
				return LogLevel.LOG;
		}
	}
}
export default ComponentStateMapper;