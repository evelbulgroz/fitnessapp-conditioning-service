/** Options controlling the behavior of ManagedStatefulComponentMixin */

export interface ManagedStatefulComponentOptions {
	/** The domain of the component, used for state management and logging
	 * @default Client constructor name
	 * @remark If not provided, the component should be registered under the constructor name of the class
	 * @example 'UserRepository'
	 * @example 'UserService'
	 */
	domain?: string;

	/**  Strategy for initializing the component and its subcomponents
	 * - `parent-first`: Initialize the parent component first, then its subcomponents
	 * - `children-first`: Initialize the subcomponents first, then the parent component
	 * @default 'parent-first'
	 */
	initializationStrategy?: 'parent-first' | 'children-first';

	/** Strategy for shutting down the component and its subcomponents
	 * - `parent-first`: Shutdown the parent component first, then its subcomponents
	 * - `children-first`: Shutdown the subcomponents first, then the parent component
	 * @default 'parent-first'
	 */
	shutDownStrategy?: 'parent-first' | 'children-first';

	/** Strategy for initializing or shutting down subcomponents
	 * - `parallel`: Initialize or shutdown all subcomponents in parallel
	 * - `sequential`: Initialize in the order they were registered, or shutdown in reverse order
	 * @remark Sequential processing is slower but guarantees execution order
	 * @default 'parallel'
	 */
	subcomponentStrategy?: 'parallel' | 'sequential';
}
export default ManagedStatefulComponentOptions;