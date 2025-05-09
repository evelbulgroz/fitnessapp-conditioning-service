import { ConfigService } from '@nestjs/config';
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainStateManager, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { FileSystemPersistenceAdapter, PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLoggableMixin } from '../libraries/stream-loggable';

import LoggingModule from '../logging/logging.module';
import UserController from './controllers/user.controller';
import UserCreatedHandler from './handlers/user-created.handler';
import UserDeletedHandler from './handlers/user-deleted.handler';
import UserRepository from './repositories/user.repo';
import UserDataService from './services/user-data.service';
import UserUpdatedHandler from './handlers/user-updated.handler';
import UserDomainStateManager from './user-domain-state-manager';

/** Main module for components managing and serving user information.
 * 
 * This module encapsulates all functionality for storing, retrieving, and serving user
 * information. It integrates with NestJS's lifecycle hooks for proper initialization and cleanup.
 * 
 * This is an auxiliary module, existing to enable per-user serving of conditioning requests.
 * It provides minimal user management, deferring to the user microservice as the single source
 * of truth for user information.
 * 
 * @implements {OnModuleInit} Handles proper initialization sequence of repository and service components.
 * @implements {OnModuleDestroy} Ensures graceful shutdown of all components.
 * 
 * Initialization sequence: Register subcomponents → Initialize self → Initialize subcomponents.
 * Shutdown sequence: Shutdown self and subcomponents → Unregister subcomponents.
 * 
 * @state-management
 * The module implements {@link ManagedStatefulComponentMixin} for advanced state management:
 * - Tracks component state through the standard lifecycle (UNINITIALIZED → INITIALIZING → OK → SHUTTING_DOWN → SHUT_DOWN)
 * - Manages hierarchical state through subcomponent registration (repository and data service)
 * - Provides observable state through componentState$ stream
 * - Automatically aggregates worst-case state from all subcomponents
 * - Ensures ordered initialization and shutdown sequences
 * 
 * @logging
 * Implements {@link StreamLoggableMixin} for structured logging:
 * - Provides contextual logging with component name and state information
 * - Supports multiple log levels (debug, info, warn, error)
 * - Logs important lifecycle events (initialization, state transitions, shutdown)
 * - Integrates with RxJS observable streams for reactive logging
 * @see {@link StreamLoggableMixin} for more details on logging capabilities and the provided strem logger utility.
 * 
 * @dependency-management
 * Uses NestJS dependency injection for:
 * - File system persistence adapter configuration
 * - Repository throttling
 * - Service and repository wiring
 * 
 * @exports Core services and handlers for use by other modules.
 */

@Module({
	imports: [LoggingModule], // Import the LoggingModule to use MergedStreamLogger
	controllers: [UserController],
	providers: [
		{ // PersistenceAdapter
			provide: PersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.user.repos.fs.dataDir') ?? 'no-such-dir';
				return new FileSystemPersistenceAdapter(dataDir);
			},
			inject: [ConfigService],
		},
		{ // REPOSITORY_THROTTLETIME
			provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
			useValue: 100
		},
		UserCreatedHandler,
		UserDeletedHandler,
		{ // UserDomainStateManager
			// Must be provided here in order for root manager to be able to detect it
			// and register it as a subcomponent.
			// But no need to inject it into this module itself.			
			provide: DomainStateManager,
			useClass: UserDomainStateManager,
		},
		UserRepository,
		UserDataService,
		UserUpdatedHandler,
	],
	exports: [
		UserCreatedHandler,
		UserDeletedHandler,
		UserRepository,
		UserDataService,
		UserUpdatedHandler,
	],
})
export class UserModule extends StreamLoggableMixin(class {}) implements OnModuleInit, OnModuleDestroy {
	constructor(
		private readonly repo: UserRepository,
		private readonly dataService: UserDataService,
		private readonly streamLogger: MergedStreamLogger, // Inject the MergedStreamLogger for logging
	) {
		super();
	}

	/** Initializes the module and its components
	 * 
	 * This method is called by NestJS during the module's initialization phase. It registers the repository and data service
	 * as subcomponents, ensuring that they are properly initialized and managed within the module's lifecycle.
	 * 
	 * @returns {Promise<void>} A promise that resolves to void when the module is fully initialized.
	 * 
	 * @error-handling During initialization, failures are captured and propagated through the state 
	 * management system, setting the component and module to FAILED state with detailed error information.
	 */
	public async onModuleInit(): Promise<void> {
		// Subscribe to log streams for logging
		this.streamLogger.subscribeToStreams([
			{ streamType: 'componentState$', component: this.repository },
			{ streamType: 'componentState$', component: this.dataService },
			// ConditioningController is not a managed component, so we don't subscribe to its componentState$ stream
			
			{ streamType: 'repoLog$', component: this.repository },
			{ streamType: 'log$', component: this.dataService },
			// UserController: Cannot get a reference to the active instance here, so it subscribes itself
		]);
	}

	/** Cleans up the module and its components
	 * 
	 * This method is called by NestJS during the module's destruction phase. It unregisters the repository and data service
	 * as subcomponents, ensuring that they are properly cleaned up and released from memory.
	 * 
	 * @returns {Promise<void>} A promise that resolves to void when the module is fully shut down.
	 */
	public async onModuleDestroy(): Promise<void> {	
	}

}
export default UserModule;