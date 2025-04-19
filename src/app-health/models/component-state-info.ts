import { ComponentState } from "./component-state";

/** Specifies the contents of a component state entry.
 * @remarks The component state is used to determine if the application is lively, and/or healthy, and ready to serve requests.
 * @remarks Components must implement this interface to be monitored by the health check service.
 * @remarks Any NestJS construct can use this to track its state, e.g. a service, controller, or module.
*/

export type ComponentStateInfo = {
	/** The name of the component. */
	name: string;

	/** The current lifecycle status of the component. */
	state: ComponentState;

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
