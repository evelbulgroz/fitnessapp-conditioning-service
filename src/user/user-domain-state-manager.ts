import { Injectable } from "@nestjs/common";

import { DomainStateManager, ManagedStatefulComponent } from '../libraries/managed-stateful-component/index';
import UserDataService from "./services/user-data.service";
import UserRepository from "./repositories/user.repo";

/**
 * Domain proxy that stands in for {@link UserModule} to enable hierarchical state management.
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
		//console.log("UserDomainStateManager.onInitialize()", JSON.stringify(this.toJSON(), null, 2)); // debug
	}

	async onShutdown(...args: any[]): Promise<void> {
		// Shut down all subcomponents
		const subcomponents = this.msc_zh7y_subcomponents || []; // todo: Find at way to do this without referring to internal properties
		await Promise.all(subcomponents.map((subcomponent: ManagedStatefulComponent) => {
			console.log("UserDomainStateManager.onShutdown() - shutting down subcomponent", subcomponent.constructor.name); // debug
			return subcomponent.shutdown();
		}));

		// Unregister all subcomponents
		for (const subcomponent of subcomponents) {
			console.log("UserDomainStateManager.onShutdown() - unregistering subcomponent", subcomponent.constructor.name); // debug
			this.unregisterSubcomponent(subcomponent);
		}
		
		// UserController is not a managed component, so we don't unregister it as a subcomponent		
		//this.unregisterSubcomponent(this.dataService);
		//this.unregisterSubcomponent(this.repository); // repo handles persistence shutdown internally
	}
}
export default UserDomainStateManager;