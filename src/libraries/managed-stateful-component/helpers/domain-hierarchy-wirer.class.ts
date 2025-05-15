import { StreamLoggableMixin } from "../../../libraries/stream-loggable";

import DomainPathExtractorOptions from "../models/domain-path-extractor-options.model";
import DomainPathExtractor from "../models/domain-path-extractor.model";
import DomainStateManager from "./domain-state-manager.class";
import filePathExtractor from "./extractors/file-path-extractor";

/**
 *  Utility class responsible for automatically wiring domain state managers into a hierarchical structure.
 * 
 * @todo Refactor to use internal mixin options for path extraction
 *
 */
export class DomainHierarchyWirer extends StreamLoggableMixin(class {}) {
		//--------------------------------------- PUBLIC API ----------------------------------------//
		
		/** 
		 * Wire domain state managers into a complete hierarchical structure.
		 * 
		 * @param managers - Array of domain state managers to wire
		 * @param pathExtractor - Function to extract the path from a domain state manager
		 * @param extractorOptions - Options for the path extractor
		 * @returns A promise that resolves when the wiring is complete
		 * @throws {Error} If the wiring process fails
		 * 
		 * 
		 */
		public async wireDomains(
			managers: DomainStateManager[],
			pathExtractor: DomainPathExtractor = filePathExtractor,
			extractorOptions: Partial<DomainPathExtractorOptions> = { appRootName: 'app', separator: '.' },
		): Promise<void> {
			const domainManagers = this.filterDomainManagers(managers);
			
			// Build hierarchy based on domain name patterns (e.g., 'app.user')
			const hierarchy = this.buildHierarchy(domainManagers, pathExtractor, extractorOptions);

			
			// Register child domains with their parents
			this.registerHierarchicalComponents(hierarchy);
		}

		//------------------------------------ PROTECTED METHODS ------------------------------------//		
		
		/*
		 * Build a hierarchical relationship map between domain state managers based on their paths.

		 * @param managers - Array of domain state managers to wire
		 * @param pathExtractor - Function to extract the path from a domain state manager
		 * @param extractorOptions - Options for the path extractor
		 * @returns A map where each key is a parent manager and the value is an array of child managers
		 * 
		 */
		protected buildHierarchy(
			managers: DomainStateManager[],
			pathExtractor: DomainPathExtractor,
			extractorOptions: Partial<DomainPathExtractorOptions>
		): Map<DomainStateManager, DomainStateManager[]> {
			// Return empty map for empty input
			if (!managers || managers.length === 0) {
					return new Map();
			}
			
			// Extract path mappings
			const { pathToManager, pathToChildren } = this.extractPathMappings(
					managers, pathExtractor, extractorOptions
			);
			
			// Construct hierarchy map
			const result = this.constructHierarchyMap(pathToManager, pathToChildren);
			
			return result;
		}
		
		/*
		 * Construct hierarchy map from path mappings
		 */
		protected constructHierarchyMap(
			pathToManager: Map<string, DomainStateManager>,
			pathToChildren: Map<string, string[]>
		): Map<DomainStateManager, DomainStateManager[]> {
			const result = new Map<DomainStateManager, DomainStateManager[]>();

			for (const [path, manager] of pathToManager.entries()) {
				const childPaths = pathToChildren.get(path) || [];
				const childManagers = childPaths
					.map(childPath => pathToManager.get(childPath))
					.filter(Boolean) as DomainStateManager[];

				// Always include the manager, even if it has no children
				result.set(manager, childManagers);
			}

			return result;
		}
		
		/*
		 * Extract path mappings from managers
		 *
		 * @param managers - Array of domain state managers to wire
		 * @param pathExtractor - Function to extract the path from a domain state manager
		 * @param extractorOptions - Options for the path extractor
		 * @returns An object containing two maps: pathToManager and pathToChildren
		 * @throws {Error} If two managers claim the same path
		 *
		 */
		protected extractPathMappings(
			managers: DomainStateManager[],
			pathExtractor: DomainPathExtractor,
			extractorOptions: Partial<DomainPathExtractorOptions> = { appRootName: 'app', separator: '.' }
		): { pathToManager: Map<string, DomainStateManager>, pathToChildren: Map<string, string[]> } {
			const pathToManager = new Map<string, DomainStateManager>();
			const pathToChildren = new Map<string, string[]>();
			
			for (const manager of managers) {
				// Extract path using the provided extractor function
				const path = pathExtractor(manager, extractorOptions).toLowerCase(); // Normalize to lowercase
				if (pathToManager.has(path)) {
					throw new Error(`Two managers claim the same path: ${path}`);
				}
				pathToManager.set(path, manager);
				
				// Initialize empty children array for each path
				if (!pathToChildren.has(path)) {
					pathToChildren.set(path, []);
				}
				
				// Determine parent path and register this path as its child
				this.registerParentChildRelationship(path, extractorOptions.separator || '.', pathToChildren);
			}
			
			return { pathToManager, pathToChildren };
		}
		
		/*
		 * Filter input to ensure we only process DomainStateManager instances
		 */
		protected filterDomainManagers(managers: any[]): DomainStateManager[] {
			return managers
				.filter(provider => provider instanceof DomainStateManager || 
							(provider?.instance && provider?.instance instanceof DomainStateManager))
				.map(provider => provider instanceof DomainStateManager ? provider : provider?.instance);
		}

		/*
		 * Register components based on the hierarchy map
		 */
		protected registerHierarchicalComponents(
			hierarchy: Map<DomainStateManager, DomainStateManager[]>
		): void {
			for (const [parentManager, childManagers] of hierarchy) {
				for (const childManager of childManagers) {
					try {
						const result = parentManager.registerSubcomponent(childManager);
						if (result === false) {
							this.logger.warn(`Failed to register subcomponent ${childManager.constructor.name} in ${parentManager.constructor.name}`);
						}
					} catch (err) {
						this.logger.warn(`Exception during subcomponent registration of ${childManager.constructor.name} in ${parentManager.constructor.name}`);
					}
				}
			}
		}
		
		/*
		 * Register parent-child relationship based on path
		 */
		protected registerParentChildRelationship(
			path: string, 
			pathSeparator: string,
			pathToChildren: Map<string, string[]>
		): void {
			const segments = path.split(pathSeparator);
			
			if (segments.length > 1) {
					segments.pop(); // Remove last segment to get parent path
					const parentPath = segments.join(pathSeparator);
			
					if (!pathToChildren.has(parentPath)) {
							pathToChildren.set(parentPath, []);
					}
					pathToChildren.get(parentPath)!.push(path);
			}
		}
		
		//------------------------------------ UTILITY METHODS ------------------------------------//
		
		/*
		 * Get a unique identifier for a manager
		 */
		protected getManagerIdentifier(manager: DomainStateManager): string {
			// Use the constructor name plus a unique property if available
			if ((manager as any).managerId) {
					return `${manager.constructor.name}:${(manager as any).managerId}`;
			}
			
			// Fall back to path or just constructor name with a random suffix if needed
			const path = this.getManagerPath(manager);
			return path ? 
					`${manager.constructor.name}:${path}` : 
					`${manager.constructor.name}:${Math.random().toString(36).substr(2, 5)}`;
		}
		
		/*
		 * Get the path of a manager
		 */
		protected getManagerPath(manager: DomainStateManager): string | undefined {
			// Try to get the path using common properties
			if ((manager as any).path) return (manager as any).path;
			if ((manager as any).__path) return (manager as any).__path;
			
			// Try to get virtual path
			if (typeof (manager as any).getVirtualPath === 'function') {
					return (manager as any).getVirtualPath();
			}
			
			// If options contains virtualPath, use that
			if ((manager as any).options?.virtualPath) {
					return (manager as any).options.virtualPath;
			}
			
			return undefined;
		}
		
		/*
		 * Serialize the hierarchy to a JSON-friendly format for inspection and debugging.
		 */
		protected serializeHierarchy(hierarchy: Map<DomainStateManager, DomainStateManager[]>): Record<string, any> {
			const result: Record<string, any> = {};
			
			for (const [parent, children] of hierarchy.entries()) {
				const parentId = this.getManagerIdentifier(parent);
				
				result[parentId] = {
						name: parent.constructor.name,
						path: this.getManagerPath(parent),
						children: children.map(child => ({
								id: this.getManagerIdentifier(child),
								name: child.constructor.name,
								path: this.getManagerPath(child)
						}))
				};
			}
			
			return result;
		}		
}

export default DomainHierarchyWirer;