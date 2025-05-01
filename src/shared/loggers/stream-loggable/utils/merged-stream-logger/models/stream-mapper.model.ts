import { Observable } from 'rxjs';

import UnifiedLogEntry from '../../../models/unified-log-event.model';

/**Interface for a stream mapper that transforms a source observable into a stream of unified log events.
 * @template T - The type of the source observable.
 * @property {string} streamType - The type of the stream being mapped.
 * @property {function} mapToLogEvents - A function that takes a source observable and an optional context string, and returns an observable of unified log events.
 * @returns {Observable<UnifiedLogEntry>} - An observable of unified log events.
 * @example
 * const streamMapper: StreamMapper<MyType> = {
 *  streamType: 'myStream',
 * mapToLogEvents: (source$, context) => {
 *   return source$.pipe(
 * 	map((data: MyType) => ({
 * 		source: LogEventSource.MY_SOURCE,
 * 		timestamp: new Date(),
 * 		level: LogLevel.INFO,
 * 		message: `Data received: ${data}`,
 * 		context: context,
 * 		data: data
 * 	}))
 * 	);
 * 	}
 * };
 */ 
export interface StreamMapper<T> {
	/** The type of the stream being mapped
	 * @type {string}
	 * @remark Generally the variable name of the stream this mapper supports.
	 * @remark This is used to match the stream to the correct mapper in the stream logger.
	 * @remark Clients should chooen a name that is descriptive and unique to the stream being mapped.
	 * @example 'repoLog$', 'componentState$', 'myStream$'
	*/
	readonly streamType: string;

	/** A function that takes a source observable and an optional context string, and returns an observable of unified log events.
	 * @param {Observable<T>} source$ - The source observable to be mapped.
	 * @param {string} [context] - An optional context string to be included in the log event.
	 * @returns {Observable<UnifiedLogEntry>} - An observable of unified log events.
	 * @example
	 * const source$ = of({ name: 'test' });
	 * const context = 'testContext';
	 * const logEvents$ = streamMapper.mapToLogEvents(source$, context);
	 * logEvents$.subscribe(logEvent => {
	 *  console.log(logEvent);
	 * });
	 * // Output: { source: 'test', timestamp: ..., level: 'info', message: 'test', context: 'testContext', data: { name: 'test' } }
	 * @remark The context is optional and can be used to provide additional information about the source of the log event.
	 * @remark The source$ observable is expected to emit values of type T, which will be transformed into unified log events.
	 * @remark The returned observable will emit unified log events that include the source, timestamp, level, message, context, and data properties
	 */
	mapToLogEvents(source$: Observable<T>, context?: string): Observable<UnifiedLogEntry>;
}
export default StreamMapper;