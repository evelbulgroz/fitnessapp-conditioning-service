import { Injectable } from "@nestjs/common";

import { DomainStateManager } from '../libraries/managed-stateful-component/index';
import UserDataService from "./services/user-data.service";
import UserRepository from "./repositories/user.repo";

// Domain proxy that stands in for user module to enable hierarchical state management
@Injectable()
export class UserDomainStateManager extends DomainStateManager {
	// filePathExtractor requires __filename to be defined on the state manager
	public readonly __filename: string;

	constructor(
		// Inject services from this domain that should be monitored
		private dataService: UserDataService,
		private repository: UserRepository,
	) {
		super();
		this.__filename = __filename;
	}
	
	async onInitialize() {
		// Register subcomponents for lifecycle management
		this.registerSubcomponent(this.repository);
		this.registerSubcomponent(this.dataService);
		// UserController is not a managed component, , so we don't register it as a subcomponent
	}

	async onShutdown(...args: any[]): Promise<void> {
		console.log("UserDomainStateManager.onShutdown()");
		// UserController is not a managed component, so we don't unregister it as a subcomponent		
		this.stateManager.unregisterSubcomponent(this.dataService);
		this.stateManager.unregisterSubcomponent(this.repository); // repo handles persistence shutdown internally
	}
}
export default UserDomainStateManager;