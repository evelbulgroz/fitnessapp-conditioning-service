import ManagedStatefulComponentMixin from "../mixins/managed-stateful-component.mixin";

/** Decorator that applies the ManagedStatefulComponentMixin to a class to add managed state functionality.
 * @see {@link ManagedStatefulComponentMixin} for details on the mixin.
 * @param target The class to decorate (expects a constructor function).
 * @template T The type of the class to decorate
 * @returns The class with the mixin applied
 * @remark This decorator is a shorthand for applying the ManagedStatefulComponentMixin to a class.
 * @remark Any inheritance of the decorated class is preserved with no changes to the class hierarchy or 'extends' syntax.
 * @remark It may be useful to add {@link ManagedStatefulComponent} to the list of implemented interfaces in the decorated class.
 * 
 * @example
 * ```typescript
 * import { WithManagedState } from './with-managed-state.decorator';
 * 
 * @WithManagedState()
 * class MyComponent {
 * 	// Component logic here
 * }
 * ```
 * 
 */
export function WithManagedState() {
	return function <T extends new (...args: any[]) => any>(target: T): T {
		return ManagedStatefulComponentMixin(target);
	};
}
export default WithManagedState;