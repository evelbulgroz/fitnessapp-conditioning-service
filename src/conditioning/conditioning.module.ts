import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainStateManager } from '../libraries/managed-stateful-component';

import AggregatorService from './services/aggregator/aggregator.service';
import ConditioningController from './controllers/conditioning.controller';
import ConditioningDomainStateManager from './conditioning-domain-state-manager';
import ConditioningLogCreatedHandler from './handlers/conditioning-log-created.handler';
import ConditioningDataService from './services/conditioning-data/conditioning-data.service';
import ConditioningLogDeletedHandler from './handlers/conditioning-log-deleted.handler';
import ConditioningLogRepository from './repositories/conditioning-log.repo';
import ConditioningLogUndeletedHandler from './handlers/conditioning-log-undeleted.handler';
import ConditioningLogUpdatedHandler from './handlers/conditioning-log-updated.handler';
import LoggingModule from '../logging/logging.module';
import ManagedStatefulFsPersistenceAdapter from '../shared/repositories/adapters/managed-stateful-fs-persistence-adapter';
import QueryMapper from './mappers/query.mapper';

/** Main module for components managing and serving conditioning logs.
 * 
 * This module encapsulates all functionality for storing, retrieving, and serving conditioning
 * activities. It integrates with NestJS's lifecycle hooks for proper initialization and cleanup.
 * 
 * Serving conditioning requests is the main purpose of this app. Therefore, this is its core module.
 * 
 * The module delegates lifecycle management to the {@link ConditioningDomainStateManager}, which
 * extends {@link ManagedStatefulComponentMixin} to provide hierarchical state management.
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
		{ // ManagedStatefulFsPersistenceAdapter
			provide: ManagedStatefulFsPersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
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
		QueryMapper
	],
})
export class ConditioningModule {	
	//------------------------------------ LIFECYCLE HOOKS --------------------------------------//

	// Handled by {@link ConditioningDomainStateManager} and/or the root domain manager.

	//------------------------------------- MANAGEMENT API --------------------------------------//

	// NestJS modules cannot be managed by the state management system, no need to implement here.
}

	
export default ConditioningModule;