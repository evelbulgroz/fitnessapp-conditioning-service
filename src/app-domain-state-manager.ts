import { DiscoveryService } from "@nestjs/core";
import { Injectable } from "@nestjs/common";

import { DomainStateManager, filePathExtractor } from './libraries/managed-stateful-component/index';
import DomainHierarchyWirer from "./libraries/managed-stateful-component/helpers/domain-hierarchy-wirer.class";

// Domain proxy that stands in for app module to enable hierarchical state management
@Injectable()
export class AppDomainStateManager extends DomainStateManager {
	// filePathExtractor requires __filename to be defined on the state manager
	public readonly __filename: string;

	constructor(
		private readonly discoveryService: DiscoveryService,
	) {
		super();
		this.__filename = __filename;
	}
	
	public async onInitialize() {
		await this.wireDomains();
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
	 */
	protected async wireDomains(): Promise<void> {
		// Find all domain state managers in the app
		const managers = this.discoveryService.getProviders().filter(provider => {
			const instance = provider.instance;
			return instance && instance instanceof DomainStateManager;
		}) as unknown as DomainStateManager[];

		// Get the default path extractor
		const pathExtractor = filePathExtractor;

		// Wire the domain hierarchy
		const wirer = new DomainHierarchyWirer();
		await wirer.wireDomains(managers, pathExtractor);
	}

}
export default AppDomainStateManager;