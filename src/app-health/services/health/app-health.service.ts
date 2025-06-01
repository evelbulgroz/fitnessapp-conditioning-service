import { Injectable } from '@nestjs/common';

import { firstValueFrom, take } from 'rxjs';

import { ComponentState, ComponentStateInfo, ManagedStatefulComponent } from '../../../libraries/managed-stateful-component';
import { Logger } from "../../../libraries/stream-loggable";

import AppStateInfo from '../../models/app-state-info.model';

/** This service is used to manage the application state and health check status.
 * @remark It keeps the application's current state in memory and provides methods to set and get the state.
 * @remark It is used by the health check controller to provide data for all health check endpoints (/healthz, /livenessz, /readinessz, /startupz).
 * @remark It is also used to manage the application state during initialization and shutdown.
 * @todo Retire existing implementation, as it no longer fits the requirements of the health check controller.
 * @todo Add methods to support each health check endpoint (/healthz, /livenessz, /readinessz, /startupz), moving over the logic from the health check controller.
 * @todo Later, revisit need to directly manipulate state, e.g. during initialization in app module
 */
@Injectable()
export class AppHealthService {
	private readonly components: ManagedStatefulComponent[] = [];
	protected state: AppStateInfo = { name: this.constructor.name, state: ComponentState.UNINITIALIZED, reason: 'AppHealthService created', updatedOn: new Date() };
	
	public constructor(protected readonly logger: Logger) {
		// Initialize the service with the default status
		this.setState({name: this.constructor.name, state: ComponentState.INITIALIZING, reason: `${this.constructor.name} initialized`, updatedOn: new Date()});
	}

	/** Get the current health status of the application and its components.
	 * @returns The overall health status of the application and its components (OK, DEGRADED, UNAVAILABLE).
	 * @remark Polls all registered components to check their health.
	 * @todo This is a very rough draft, refactor later
	 */
	public async getState(): Promise<ComponentStateInfo> {
		const unhealthyComponents: ComponentStateInfo[] = [];
	
		for (const component of this.components) {
			//await component.initialize();
			const stateInfo = await firstValueFrom(component.componentState$.pipe(take(1))) as ComponentStateInfo;

			const isHealthy = stateInfo.state === ComponentState.OK || stateInfo.state === ComponentState.DEGRADED;
			if (!isHealthy) {
				const stateInfo = await firstValueFrom(component.componentState$.pipe(take(1))) as ComponentStateInfo;
				unhealthyComponents.push(stateInfo);
				this.logger.warn(`${this.constructor.name}.getState Component ${stateInfo.name} is ${stateInfo.state}: ${stateInfo.reason}`);
			}
		}
	
		if (unhealthyComponents.length > 0) {
			return {
				name: 'AppHealthService',
				state: ComponentState.DEGRADED,
				reason: `Unhealthy components: ${unhealthyComponents.join(', ')}`,
				updatedOn: new Date(),
				components: unhealthyComponents,
			};
		}
		
		this.logger.log(`${this.constructor.name}.getState All components are healthy`);
		return { name: this.constructor.name,  state: ComponentState.OK, reason: 'All components are healthy', updatedOn: new Date() };
	}
	
	/** Set the status of the application and log the change.
	 * @param info The new status and (optional) reason for the change.
	 * @returns void
	 * @todo Reconsider if this is necessary and useful, or if it should be removed.
	 */
	public setState(info: AppStateInfo) {
		this.state = {...info, updatedOn: new Date()};
		this.logger.log(`AppHealthService status changed to ${info.state} (${info.reason})`, this.constructor.name);
	}

	/** Register a monitorable component with the health service.
	 * @param component The component to register.
	 * @returns void
	 * @remark The component must implement the MonitorableComponent interface to be registered.
	 * @remark The component will be included in the health check status.
	 */
	public registerComponent(component: ManagedStatefulComponent): void {
		this.components.push(component);
		this.logger.log(`Registered component: ${component.constructor.name}`);
	}	

	/** Check if the service is alive enough to respond to health checks */
	public isAlive() {
		return true; // Always return true so /health remains available
	}
}

export default AppHealthService;