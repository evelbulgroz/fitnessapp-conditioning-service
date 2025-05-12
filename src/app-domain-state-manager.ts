import { DiscoveryService } from "@nestjs/core";
import { Inject, Injectable } from "@nestjs/common";

import { DomainPathExtractor, DomainStateManager, ManagedStatefulComponent } from './libraries/managed-stateful-component/index';
import DOMAIN_PATH_EXTRACTOR from './shared/domain/domain-path-extractor.token';

import DomainHierarchyWirer from "./libraries/managed-stateful-component/helpers/domain-hierarchy-wirer.class";

/**
 * Domain proxy that stands in for {@link AppModule} to enable hierarchical state management.
 * 
 * This class is the root manager responsible for managing the state of the whole application.
 * 
 * It wires up the domain hierarchy by finding all domain state managers in the app
 * and connecting them to their parent managers.
 * 
 * Sets a custom __filename property on itself the current file, as this is required
 * by the filePathExtractor which is expected to be injected into the class.
 * 
 * @see {@link DomainStateManager} for more information on how domain state managers work.
 * @see {@link DomainHierarchyWirer} for more information on how domain hierarchy wiring works.
 */
@Injectable()
export class AppDomainStateManager extends DomainStateManager {	
	public readonly __filename: string = __filename; // filePathExtractor requires __filename to be defined on the state manager

	constructor(
		private readonly discoveryService: DiscoveryService,
		@Inject(DOMAIN_PATH_EXTRACTOR) private readonly pathExtractor: DomainPathExtractor
	) {
		super();
	}
	
	public async onInitialize() {
		await this.initializeStateManagers();
	}

	// NOTE: No need for onModuleDestroy() here: the base mixin class will take care of shutting down all subcomponents.

	/**
	 * Wire the domain hierarchy by finding all domain state managers in the app
	 * and connecting them to their parent managers.
	 * 
	 * This is done by using the `DomainHierarchyWirer` to determine the path of each
	 * manager and connecting them based on their paths.
	 *  
	 * @see {@link DomainStateManager} for more information on how domain state managers work.
	 * @see {@link DomainHierarchyWirer} for more information on how domain hierarchy wiring works.
	 * @returns {Promise<void>} A promise that resolves when the wiring is complete.
	 */
	protected async initializeStateManagers(): Promise<void> {
		// Find all domain state managers in the app
		const managers = this.discoveryService.getProviders().filter(provider => {
			const instance = provider.instance;
			return instance && instance instanceof DomainStateManager;
		}) as unknown as DomainStateManager[];

		// Wire the domain hierarchy
		const wirer = new DomainHierarchyWirer();
		await wirer.wireDomains(managers, this.pathExtractor);
	}
}
export default AppDomainStateManager;