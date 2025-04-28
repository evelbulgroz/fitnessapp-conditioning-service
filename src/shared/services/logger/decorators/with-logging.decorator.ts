import LoggableMixin from '../mixins/loggable.mixin';
import LoggableComponent from '../models/loggable-component.model';

/** Decorator that applies the LoggableMixin to a class to add logging capabilities.
 * @see {@link LoggableMixin} for details on the mixin.
 * @returns A decorator function that applies the LoggableMixin to the decorated class
 * @remark This decorator is a shorthand for applying the LoggableMixin to a class.
 * @remark Any inheritance of the decorated class is preserved with no changes to the class hierarchy or 'extends' syntax.
 * @remark It may be useful to add {@link LoggableComponent} to the list of implemented interfaces in the decorated class.
 * 
 * @example
 * ```typescript
 * import { WithLogging } from './with-logging.decorator';
 * 
 * @WithLogging()
 * class MyService {
 *   // Service implementation
 * }
 * ```
 */
export function WithLogging() {
	return function <T extends new (...args: any[]) => any>(target: T): T & (new (...args: any[]) => LoggableComponent) {
		return LoggableMixin(target) as T & (new (...args: any[]) => LoggableComponent);
	};
}
export default WithLogging;