import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainStateManager, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { FileSystemPersistenceAdapter, PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { MergedStreamLogger, StreamLoggableMixin } from '../libraries/stream-loggable';

import AggregationQueryMapper from './mappers/aggregation-query.mapper';
import AggregatorService from './services/aggregator/aggregator.service';
import ConditioningController from './controllers/conditioning.controller';
import ConditioningLog from './domain/conditioning-log.entity';
import ConditioningLogDTO from './dtos/conditioning-log.dto';
import ConditioningLogCreatedHandler from './handlers/conditioning-log-created.handler';
import ConditioningDataService from './services/conditioning-data/conditioning-data.service';
import ConditioningLogDeletedHandler from './handlers/conditioning-log-deleted.handler';
import ConditioningLogRepository from './repositories/conditioning-log.repo';
import ConditioningLogUndeletedHandler from './handlers/conditioning-log-undeleted.handler';
import ConditioningLogUpdatedHandler from './handlers/conditioning-log-updated.handler';
import LoggingModule from '../logging/logging.module';
import ManagedStatefulFsPersistenceAdapter from '../shared/repositories/adapters/managed-stateful-fs-persistence-adapter';
import QueryMapper from './mappers/query.mapper';
import ConditioningDomainStateManager from './conditioning-domain-state-manager';

/** Main module for components managing and serving conditioning logs.
 * 
 * This module encapsulates all functionality for storing, retrieving, and serving conditioning
 * activities. It integrates with NestJS's lifecycle hooks for proper initialization and cleanup.
 * 
 * Serving conditioning requests is the main purpose of this app. Therefore, this is its core module.
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
	imports: [
		LoggingModule, // import logging module for logging capabilities
	],
	controllers: [
		ConditioningController
	],
	providers: [
		AggregatorService,
		AggregationQueryMapper,
		ConditioningDataService,
		{ // ConditioningDomainStateManager
			// Must be provided here in order for root manager to be able to detect it
			// and register it as a subcomponent.
			// But no need to inject it into this module itself.
			provide: DomainStateManager,
			useClass: ConditioningDomainStateManager,
		},
		ConditioningLogCreatedHandler,
		ConditioningLogDeletedHandler,
		ConditioningLogRepository,
		ConditioningLogUndeletedHandler,
		ConditioningLogUpdatedHandler,
		{ // Persistence adapter for file system storage
			provide: PersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
				//return new FileSystemPersistenceAdapter(dataDir);
				return new ManagedStatefulFsPersistenceAdapter(dataDir);
			},
			inject: [ConfigService],
		},
		QueryMapper,
		{ // REPOSITORY_THROTTLETIME
			provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
			useValue: 100
		},		
	],
	exports: [
		ConditioningDataService,
		ConditioningLogCreatedHandler,
		ConditioningLogDeletedHandler,
		ConditioningLogRepository,
		ConditioningLogUndeletedHandler,
		ConditioningLogUpdatedHandler,
	],
})
export class ConditioningModule extends StreamLoggableMixin(class {}) implements OnModuleInit {
	
	//--------------------------------------- CONSTRUCTOR ---------------------------------------//

	constructor(
		private readonly repository: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly dataService: ConditioningDataService,
		private readonly streamLogger: MergedStreamLogger,
	) {
		super();		
	}

	//------------------------------------ LIFECYCLE HOOKS --------------------------------------//

	/** Initializes the module and its components
	 * 
	 * This method is called by NestJS during the module's initialization phase. It sets up the logger
	 * for the module and subscribes to the log streams for logging.
	 * 
	 * @returns {Promise<void>} A promise that resolves to void when the module is fully initialized.
	 * 
	 * @error-handling During initialization, failures are captured and propagated through the state 
	 * management system, setting the component and module to FAILED state with detailed error information.
	 */
	public async onModuleInit(): Promise<void> {
		// Subscribe to log streams for logging
		this.streamLogger.subscribeToStreams([
			// Subscribe to component state streams for logging
			{ streamType: 'componentState$', component: this.repository },
			{ streamType: 'componentState$', component: this.dataService },
			{ streamType: 'componentState$', component: this.repository },
			{ streamType: 'componentState$', component: this.dataService },
			// ConditioningController is not a managed component, so we don't subscribe to its componentState$ stream
			
			// Subscribe to log streams for logging
			{ streamType: 'repoLog$', component: this.repository },
			{ streamType: 'log$', component: this.dataService },
			// ConditioningController: Cannot get a reference to the active instance here, so it subscribes itself
		]);
	}
	// NOTE: No need for onModuleDestroy() here: clean up is handled by the root module

	//------------------------------------- MANAGEMENT API --------------------------------------//

	// NestJS modules cannot be managed by the state management system, no need to implement here.
}

	
export default ConditioningModule;