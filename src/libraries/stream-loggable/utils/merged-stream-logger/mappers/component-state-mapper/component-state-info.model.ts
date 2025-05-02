import { ComponentStateDemo } from "./component-state.enum";

/** Specifies the contents of a component state entry.
 * @remark This interface is only provided for demonstration purposes.
 * @remark To avoid external dependencies, it is not exported from this library.
*/
export type ComponentStateInfo = {
	/** The name of the component. */
	name: string;

	/** The current lifecycle status of the component. */
	state: ComponentStateDemo;

	/** The reason for the current state of the component.
	 * @remark This is optional and may be used to provide additional information about the state.
	 */
	reason?: string;

	/** The time when the state was last updated. */
	updatedOn: Date;

	/** List of sub-components that and their states. */
	/** @remark This is optional and may be used to provide additional information about the overall state of the component. */
	components?: ComponentStateInfo[];
};
export default ComponentStateInfo;
