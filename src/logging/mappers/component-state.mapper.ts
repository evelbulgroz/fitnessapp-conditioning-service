import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ComponentState, ComponentStateInfo } from '../../libraries/managed-stateful-component';
import {LogEventSource, LogLevel, StreamMapper, UnifiedLogEntry} from '../../libraries/stream-loggable';

@Injectable()
export class ComponentStateMapper extends StreamMapper<ComponentStateInfo> {
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
	
	protected mapStateToLogLevel(state: ComponentState): LogLevel {
			switch (state) {
				case ComponentState.FAILED:
					return LogLevel.ERROR;
				case ComponentState.DEGRADED:
					return LogLevel.WARN;			
				// Most other states are INFO, but we can be more specific if needed.
				default:
					return LogLevel.INFO;
			}
		}
}
export default ComponentStateMapper;