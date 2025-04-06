import { Injectable } from "@nestjs/common";

import { Logger } from "@evelbulgroz/ddd-base";

import AppHealthInfo from "../../domain/app-health-info.model";
import AppHealthStatus from "../../domain/app-health-status.enum";

/** This service is used to manage the application state and health check status.
 * @remark It keeps the application's current state in memory and provides methods to set and get the state.
 * @remark It is used by the health check controller to determine if the application is lively, and/or healthy, and ready to serve requests.
 * @remark It is also used to manage the application state during initialization and shutdown.
 */
@Injectable()
export class AppHealthService {
	protected status: AppHealthStatus;
	protected reason: string | undefined;

	public constructor(protected readonly logger: Logger) {
		// Initialize the service with the default status
		this.setStatus(AppHealthStatus.INITIALIZING, `${this.constructor.name} initialized`);
	}

	/** Set the status of the service and log the change.
	 * @param status The new status to set.
	 * @param reason An optional reason for the status change.
	 * @returns void
	 * @remark This method is used to update the status of the service and log the change.
	 */
	public setStatus(status: AppHealthStatus, reason?: string) {
		this.status = status;
		this.reason = reason;
		this.logger.log(`${this.constructor.name}.setStatus AppHealthService status changed to ${status} (${reason})`);
	}

	/** Get the current status of the service.
	 * @returns The current status of the service.
	 * @remark This method is used to get the current status of the service.
	 */
	public getState(): AppHealthInfo {
		return { status: this.status, reason: this.reason };
	}

	/** Check if the service is alive enough to respond to health checks */
	public isAlive() {
		return true; // Always return true so /health remains available
	}
}

export default AppHealthService;