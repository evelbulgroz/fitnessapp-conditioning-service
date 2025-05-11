import { DiscoveryService } from "@nestjs/core";
import { Injectable } from "@nestjs/common";

import { domainPathExtractor, DomainStateManager } from './libraries/managed-stateful-component/index';

import DomainHierarchyWirer from "./libraries/managed-stateful-component/helpers/domain-hierarchy-wirer.class";

/**
 * Domain proxy that stands in for {@link AppModule} to enable hierarchical state management.
 * 
 * This class is the root manager responsible for managing the state of the whole application.
 * 
 * It wires up the domain hierarchy by finding all domain state managers in the app
 * and connecting them to their parent managers.
 * 
 * Uses the default filePathExtractor and period ('.) separator to determine
 * the path of each manager. Sets a custom __filename property to the current file name
 * in order to enable the filePathExtractor to work correctly.
 * 
 * @see {@link DomainStateManager} for more information on how domain state managers work.
 * @see {@link DomainHierarchyWirer} for more information on how domain hierarchy wiring works.
 * 
 * @todo Get extractor from DI container instead of using default filePathExtractor
 */
@Injectable()
export class AppDomainStateManager extends DomainStateManager {	
	public readonly __filename: string = __filename; // filePathExtractor requires __filename to be defined on the state manager

	constructor(
		private readonly discoveryService: DiscoveryService,
	) {
		super();
	}
	
	public async onInitialize() {
		await this.initializeStateManagers();
	}

	public async onShutdown(...args: any[]): Promise<void> {
		//console.log("AppDomainStateManager.onShutdown()"); // debug

		// Unregister all subcomponents
		for (const subcomponent of this.subcomponents) {
			await subcomponent.shutdown(...args);
			this.unregisterSubcomponent(subcomponent);
		}
		this.subcomponents = [];
	}

	/**
	 * Wire the domain hierarchy by finding all domain state managers in the app
	 * and connecting them to their parent managers.
	 * 
	 * This is done by using the filePathExtractor to determine the path of each manager
	 * and connecting them based on their paths.
	 * 
	 * @returns {Promise<void>} A promise that resolves when the wiring is complete.
	 * 
	 * @see {@link DomainStateManager} for more information on how domain state managers work.
	 * 
	 * @todo Figure out how to access static wireDomains method from the mixin
	 */
	protected async initializeStateManagers(): Promise<void> {
		// Find all domain state managers in the app
		const managers = this.discoveryService.getProviders().filter(provider => {
			const instance = provider.instance;
			return instance && instance instanceof DomainStateManager;
		}) as unknown as DomainStateManager[];

		// Wire the domain hierarchy
		const wirer = new DomainHierarchyWirer();
		await wirer.wireDomains(managers); // todo: use injected file extractor set up with options from config service 
	}
}
export default AppDomainStateManager;