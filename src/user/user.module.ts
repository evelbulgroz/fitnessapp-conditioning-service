import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { DomainStateManager, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';

import LoggingModule from '../logging/logging.module';
import ManagedStatefulFsPersistenceAdapter from '../shared/repositories/adapters/managed-stateful-fs-persistence-adapter';
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
 * The module delegates lifecycle management to the {@link UserDomainStateManager}, which
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
	imports: [LoggingModule], // Import the LoggingModule to use MergedStreamLogger
	controllers: [UserController],
	providers: [
		{ // ManagedStatefulFsPersistenceAdapter
			provide: ManagedStatefulFsPersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.user.repos.fs.dataDir') ?? 'no-such-dir';
				return new ManagedStatefulFsPersistenceAdapter(dataDir);
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
export class UserModule {
	
	//------------------------------------ LIFECYCLE HOOKS --------------------------------------//

	// Handled by {@link UserDomainStateManager} and/or the root domain manager.

	//------------------------------------- MANAGEMENT API --------------------------------------//

	// NestJS modules cannot be managed by the state management system, no need to implement here.
}
export default UserModule;