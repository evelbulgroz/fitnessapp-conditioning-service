import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ComponentStateInfo, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
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
import QueryMapper from './mappers/query.mapper';

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
		ConditioningLogCreatedHandler,
		ConditioningLogDeletedHandler,
		ConditioningLogRepository,
		ConditioningLogUndeletedHandler,
		ConditioningLogUpdatedHandler,
		{
			provide: PersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
				return new FileSystemPersistenceAdapter(dataDir);
			},
			inject: [ConfigService],
		},
		QueryMapper,
		{
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
export class ConditioningModule extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements OnModuleInit, OnModuleDestroy {
	constructor(
		private readonly repository: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly dataService: ConditioningDataService,
		private readonly streamLogger: MergedStreamLogger,
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
		// Register subcomponents for lifecycle management
		this.registerSubcomponent(this.repository); // repo handles persistence initialization internally
		this.registerSubcomponent(this.dataService);
		// ConditioningController is not a managed component, so we don't register it as a subcomponent

		// Subscribe to log streams for logging
		
		//console.log('ConditioningController', this.moduleRef.get(ConditioningController, { strict: false })); // logs a controller instance
		
		this.streamLogger.subscribeToStreams([
			{ streamType: 'componentState$', component: this.repository },
			{ streamType: 'componentState$', component: this.dataService },
			// ConditioningController is not a managed component, so we don't subscribe to its componentState$ stream
			
			{ streamType: 'repoLog$', component: this.repository },
			{ streamType: 'log$', component: this.dataService },
			// ConditioningController: Cannot get a reference to the active instance here, so it subscribes itself
		]);
				
		await this.initialize(); // initialize module and all managed subcomponents
	}

	/** Cleans up the module and its components
	 * 
	 * This method is called by NestJS during the module's destruction phase. It unregisters the repository and data service
	 * as subcomponents, ensuring that they are properly cleaned up and released from memory.
	 * 
	 * @returns {Promise<void>} A promise that resolves to void when the module is fully shut down.
	 */
	public async onModuleDestroy(): Promise<void> {
		await this.shutdown(); // shutdown module and all managed subcomponents
		// ConditioningController is not a managed component, so we don't unregister it as a subcomponent
		this.unregisterSubcomponent(this.repository); // repo handles persistence shutdown internally
		this.unregisterSubcomponent(this.dataService);
	}}
export default ConditioningModule;