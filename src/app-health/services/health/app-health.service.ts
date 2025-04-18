import { Injectable } from "@nestjs/common";

import { Logger } from "@evelbulgroz/logger";

//import AppHealthInfo from "../../domain/app-health-info.model";
//import AppHealthStatus from "../../domain/app-health-status.enum";

/** Overall application health status.
 * @remark This is used by the health check controller to report if the application is lively, and/or healthy, and ready to serve requests.
*/
export enum HealthState {
	/** Indicates that the application is healthy and ready to serve requests. */
	OK = 'OK',

	/** Indicates that the application is partially functional but may have some issues (e.g., a dependency is slow or unavailable). */
	DEGRADED = 'DEGRADED',

	/** Indicates that the application is not healthy and cannot serve requests. */
	UNAVAILABLE = 'UNAVAILABLE',

	/** Indicates that the application is starting up and is not yet ready to serve requests. */
	INITIALIZING = 'INITIALIZING',

	/** Indicates that the application is shutting down and will not serve requests. */
	SHUTTING_DOWN = 'SHUTTING_DOWN',
}

export type AppHealthInfo = {
	status: HealthState;
	reason?: string;
};
/** Lifecycle state of  any monitorable application component.
 * @remark This is used by this service to track the lifecycle of the application and its components.
*/
export enum ComponentLifecycleStatus {
	/** The component has not yet started its initialization process. */
	UNINITIALIZED = 'UNINITIALIZED',

	/** The component is in the process of being initialized. */
	INITIALIZING = 'INITIALIZING',

	/** The component has been initialized and is ready to serve requests. */
	INITIALIZED = 'INITIALIZED',

	/** The component is in the process of shutting down or being cleaned up. */
	DESTROYING = 'DESTROYING',

	/** The component has completed its shutdown process and is no longer functional.
	 * * @remark In most cases, the component will no longer be available for use after this state.
	 */
	DESTROYED = 'DESTROYED',
}

/** Info about the lifecycle state of a monitorable application component.
 * @remark This is used by this service to track the lifecycle of the application and its components.
 */
export type ComponentHealthInfo = {
	status: ComponentLifecycleStatus;
	reason?: string;
};

export interface ManageableComponent {
	/** Initializes the component if it is not already initialized.
	 * @returns Promise that resolves to void if the component was initialized, rejects with error if initialization fails.
	 * @remark The component should respond gracefully to concurrent requests for initialization.
	 * @remark The component should be in the INITIALIZED state after this method is called.
	 */
	initialize(): Promise<void>;

	/** Destroys the component and cleans up any resources it is using.
	 * @returns Promise that resolves to void if the component was destroyed, rejects with error if destruction fails.
	 * @remark The component should respond gracefully to concurrent requests for destruction.
	 * @remark The component should be in the DESTROYED state after this method is called.
	 */
	shutdown(): Promise<void>;
}

/** Interface for any monitorable application component.
 * @remark This is used by this service to track the lifecycle of the application and its components.
 * @remark Components must implement this interface to be monitored by the health check service.
 */
export interface MonitorableComponent {
	/** Destroy the component and clean up any resources it is using. */
	/** @returns Promise that resolves when the component is destroyed. */
	destroy(): Promise<void>;

	/** The current lifecycle status of the component.
	 * * @returns The current lifecycle status of the component.
	 */
	getState(): ComponentHealthInfo;

	/** Initializes the component if it is not already initialized.
	 * @returns Promise that resolves to true if the component was initialized, false if initialization fails.
	 */
	initialize(): Promise<boolean>;
}

/** This service is used to manage the application state and health check status.
 * @remark It keeps the application's current state in memory and provides methods to set and get the state.
 * @remark It is used by the health check controller to determine if the application is lively, and/or healthy, and ready to serve requests.
 * @remark It is also used to manage the application state during initialization and shutdown.
 * @todo Refactor this to use Terminus, as suggested by ChatGPT, to provide a more robust health check implementation.
 * @todo Add a status page that shows the health of all services and dependencies
 */
@Injectable()
export class AppHealthService {
	private readonly components: MonitorableComponent[] = [];
	protected status: HealthState;
	protected reason: string | undefined;

	public constructor(protected readonly logger: Logger) {
		// Initialize the service with the default status
		this.setState({status: HealthState.INITIALIZING, reason: `${this.constructor.name} initialized`});
	}

	/** Get the current health status of the application and its components.
	 * @returns The overall health status of the application and its components (OK, DEGRADED, UNAVAILABLE).
	 * @remark Polls all registered components to check their health.
	 */
	public async getState(): Promise<AppHealthInfo> {
		const unhealthyComponents: string[] = [];
	
		for (const component of this.components) {
			const isInitialized = await component.initialize();
			if (!isInitialized) {
				const state = component.getState();
				unhealthyComponents.push(`${component.constructor.name}: ${state.status} (${state.reason || 'No reason provided'})`);
			}
		}
	
		if (unhealthyComponents.length > 0) {
			return {
				status: HealthState.DEGRADED,
				reason: `Unhealthy components: ${unhealthyComponents.join(', ')}`,
			};
		}
		
		this.logger.log(`${this.constructor.name}.getState All components are healthy`);
		return { status: HealthState.OK, reason: 'All components are healthy' };
	}
	
	/** Set the status of the application and log the change.
	 * @param info The new status and (optional) reason for the change.
	 * @returns void
	 * @todo Reconsider if this is necessary and useful, or if it should be removed.
	 */
	public setState(info: AppHealthInfo) {
		this.status = info.status;
		this.reason = info.reason;
		this.logger.log(`${this.constructor.name}.setStatus AppHealthService status changed to ${info.status} (${info.reason})`);
	}

	/** Register a monitorable component with the health service.
	 * @param component The component to register.
	 * @returns void
	 * @remark The component must implement the MonitorableComponent interface to be registered.
	 * @remark The component will be included in the health check status.
	 */
	public registerComponent(component: MonitorableComponent): void {
		this.components.push(component);
		this.logger.log(`Registered component: ${component.constructor.name}`);
	}	

	/** Check if the service is alive enough to respond to health checks */
	public isAlive() {
		return true; // Always return true so /health remains available
	}
}

export default AppHealthService;