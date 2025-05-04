/** Information about a stream to subscribe to */
export interface StreamInfo {
	/** The type of stream using a key matched by a mapper, e.g. 'log$', 'componentState$'
	 * @remark This is the property name of the observable stream on the component instance.
	*/
	streamType: string;
	/** The component instance that has an Observable by the name of streamType
	 * @remark Instance constructor must not be anonymous function or arrow function, as name is used for indexing and logging.
	 */
	component: any;
	/** Optional custom key for the subscription, defaults to component name
	 * @remark This is useful for anonymous functions or arrow functions where the constructor name is not available.
	 */
	customKey?: string;
}
