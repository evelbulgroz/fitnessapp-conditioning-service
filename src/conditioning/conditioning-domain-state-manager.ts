import { Injectable } from "@nestjs/common";

import { DomainStateManager } from '../libraries/managed-stateful-component/index';
import ConditioningDataService from "./services/conditioning-data/conditioning-data.service";
import ConditioningLog from "./domain/conditioning-log.entity";
import ConditioningLogDTO from "./dtos/conditioning-log.dto";
import ConditioningLogRepository from "./repositories/conditioning-log.repo";

// Domain proxy that stands in for conditioning module to enable hierarchical state management
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