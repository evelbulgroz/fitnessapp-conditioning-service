import { Injectable } from "@nestjs/common";

import { DomainStateManager } from '../libraries/managed-stateful-component/index';
import UserDataService from "./services/user-data.service";
import UserRepository from "./repositories/user.repo";

/**
 * Domain proxy that stands in for {@link UserModule} to enable hierarchical state management.
 * 
 * This class is responsible for registering subcomponents for lifecycle management.
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
export class UserDomainStateManager extends DomainStateManager {
	// filePathExtractor requires __filename to be defined on the state manager
	public readonly __filename: string;

	constructor(
		// Inject services from this domain that should be monitored
		private dataService: UserDataService,
		private repository: UserRepository,
	) {
		super({
			subcomponentStrategy: 'sequential', // components must initialize in order
		});
		this.__filename = __filename;
	}
	
	async onInitialize() {
		// Register subcomponents for lifecycle management
		this.registerSubcomponent(this.repository); // repo needs to initialize before data service
		this.registerSubcomponent(this.dataService);
		// UserController is not a managed component, , so we don't register it as a subcomponent
	}

	// NOTE: No need to implement onShutdown() here, as the root manager is sufficient.
}
export default UserDomainStateManager;