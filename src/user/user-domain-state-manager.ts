import { Injectable } from "@nestjs/common";

import { MergedStreamLogger, StreamLoggableMixin } from "../libraries/stream-loggable";

import { DomainStateManager } from '../libraries/managed-stateful-component/index';
import UserDataService from "./services/user-data.service";
import UserRepository from "./repositories/user.repo";

/**
 * Domain proxy that stands in for {@link ConditioningModule} to enable hierarchical state management.
 * 
 * This class is responsible for registering subcomponents for lifecycle management using {@link ManagedStatefulComponentMixin}:
 * - Tracks component state through the standard lifecycle (UNINITIALIZED → INITIALIZING → OK → SHUTTING_DOWN → SHUT_DOWN)
 * - Manages hierarchical state through subcomponent registration (repository and data service)
 * - Provides observable state through componentState$ stream
 * - Automatically aggregates worst-case state from all subcomponents
 * - Ensures ordered initialization and shutdown sequences 
 * - Initialization sequence: Register subcomponents → Initialize self → Initialize subcomponents.
 * - Shutdown sequence: Shutdown self and subcomponents → Unregister subcomponents.
 *  
 * This enables the root manager to wire the domain hierarchy by finding all domain
 * state managers in the app, and managing their state.
 * 
 * This manager relies on the root manager for lifecycle management, so does not
 * include any state change triggers of its own.
 *
 * Too keep things in one place, this manager also sets up logging for the subcomponents.
 *
 * Root manager uses the default filePathExtractor and period ('.) separator to determine
 * the path of each manager. This manager sets a custom __filename property to the current
 * file name in order to enable this to work correctly. * 
 * 
 * @see {@link DomainStateManager} for more information on how domain state managers work.
 * @see {@link DomainHierarchyWirer} for more information on how domain hierarchy wiring works.
 * @see {@link ManagedStatefulComponentMixin} for more information on how state management works.
 * 
 */
@Injectable()
export class UserDomainStateManager extends StreamLoggableMixin(DomainStateManager) {
	// filePathExtractor requires __filename to be defined on the state manager
	public readonly __filename: string;

	constructor(
		// Inject services from this domain that should be monitored
		private dataService: UserDataService,
		private repository: UserRepository,
		private streamLogger: MergedStreamLogger,
	) {
		super({
			subcomponentStrategy: 'sequential', // components must initialize in order
		});
		this.__filename = __filename;
	}
	
	async onInitialize() {
		// Subscribe to log streams for logging
		this.streamLogger.subscribeToStreams([
			// Subscribe to component state streams for logging
			{ streamType: 'componentState$', component: this.repository },
			{ streamType: 'componentState$', component: this.dataService },
			// ConditioningController is not a managed component, so we don't subscribe to its componentState$ stream
			
			// Subscribe to log streams for logging
			{ streamType: 'repoLog$', component: this.repository },
			{ streamType: 'log$', component: this.dataService },
			// ConditioningController: Cannot get a reference to the active instance here, so it subscribes itself
		]);

		// Register subcomponents for lifecycle management
		this.registerSubcomponent(this.repository); // repo needs to initialize before data service
		this.registerSubcomponent(this.dataService);
		// UserController is not a managed component, , so we don't register it as a subcomponent
	}

	// NOTE: No need to implement onShutdown() here, as the root manager is sufficient.
}
export default UserDomainStateManager;