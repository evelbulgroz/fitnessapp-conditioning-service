import { Injectable } from "@nestjs/common";

import { DomainStateManager } from '../libraries/managed-stateful-component/index';
import ConditioningDataService from "./services/conditioning-data/conditioning-data.service";
import ConditioningLog from "./domain/conditioning-log.entity";
import ConditioningLogDTO from "./dtos/conditioning-log.dto";
import ConditioningLogRepository from "./repositories/conditioning-log.repo";

/**
 * Domain proxy that stands in for conditioning module to enable hierarchical state management.
 * 
 * This class is responsible for managing registering and unregistering subcomponents
 * at the appropriate times in the lifecycle of the application.
 * 
 * This enables the root manager to wire the domain hierarchy by finding all domain
 * state managers in the app, and managing their state.
 * 
 * This manager relies on the root manager for lifecycle management, so does not
 * include any state change triggers of its own.
 * 
 * Root manager uses the default filePathExtractor and period ('.) separator to determine
 * the path of each manager. This manager sets a custom __filename property to the current
 * file name in order to enable this to work correctly.
 * 
 * @see {@link DomainStateManager} for more information on how domain state managers work.
 * @see {@link DomainHierarchyWirer} for more information on how domain hierarchy wiring works.
 * 
 */
@Injectable()
export class ConditioningDomainStateManager extends DomainStateManager {
	// filePathExtractor requires __filename to be defined on the state manager
	public readonly __filename: string;

	constructor(
		// Inject services from this domain that should be monitored
		private readonly dataService: ConditioningDataService,
		private readonly repository: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
	) {
		super();
		this.__filename = __filename;
	}
	
	async onInitialize() {
		// Register subcomponents for lifecycle management
		//this.registerSubcomponent(this.repository); // repo needs to initialize before data service
		this.registerSubcomponent(this.dataService);
		// ConditioningController is not a managed component, so we don't register it as a subcomponent
	}

	async onShutdown(...args: any[]): Promise<void> {
		//console.log("ConditioningDomainStateManager.onShutdown()"); // debug
		// ConditioningController is not a managed component, so we don't unregister it as a subcomponent
		this.unregisterSubcomponent(this.dataService);
		this.unregisterSubcomponent(this.repository); // repo handles persistence shutdown internally
		
	}
}
export default ConditioningDomainStateManager;