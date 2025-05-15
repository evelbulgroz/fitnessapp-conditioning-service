import { StreamLoggableMixin } from "../../../libraries/stream-loggable";

import DomainPathExtractorOptions from "../models/domain-path-extractor-options.model";
import DomainPathExtractor from "../models/domain-path-extractor.model";
import DomainStateManager from "./domain-state-manager.class";
import filePathExtractor from "./extractors/file-path-extractor";

/**
 * Utility class responsible for automatically wiring domain state managers into a hierarchical structure.
 *
 * Usage:
 *   const wirer = new DomainHierarchyWirer();
 *   await wirer.wireDomains(managers, pathExtractor, { separator: '.' });
 *
 * Notes:
 * - If using virtual paths, every domain state manager must have a unique virtual path.
 * - All managers must use the same path strategy (all virtual or all actual paths).
 * - Mixing virtual and actual paths is not supported and may lead to undefined behavior.
 *
 * @todo Refactor to use internal mixin options for path extraction(?)
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
		 * @remark If using virtual paths, every domain state manager must have a unique virtual path.
		 *   Virtual path is set in the options when creating the domain state manager.
		 *   Althougn mixed paths may work, this is currently not comprehensively tested.
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
		 * @todo Improve error handling and logging
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
		 *
		 * @param pathToManager - Map of paths to their corresponding domain state managers
		 * @param pathToChildren - Map of paths to their child paths
		 * @returns A map where each key is a parent manager and the value is an array of child managers
		 * 
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
				// Extract path using the provided extractor function, then normalize it
				// to ensure consistent casing and formatting
				const path = this.normalizePath(pathExtractor(manager, extractorOptions), extractorOptions.separator);
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
		 *
		 * @param managers - Array of domain state managers to wire
		 * @returns An array of filtered domain state managers
		 * @todo Throw {Error} If the input is not an array or if no valid managers are found
		 */
		protected filterDomainManagers(managers: any[]): DomainStateManager[] {
			return managers
				.filter(provider => provider instanceof DomainStateManager || 
							(provider?.instance && provider?.instance instanceof DomainStateManager))
				.map(provider => provider instanceof DomainStateManager ? provider : provider?.instance);
		}

		/*
		 * Register components based on the hierarchy map
		 *
		 * @param hierarchy - The hierarchy map where each key is a parent manager and the value is an array of child managers
		 * @returns void
		 * @logs warning if registration fails
		 * 
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
		 *
		 * @param path - The path of the child manager
		 * @param pathSeparator - The separator used in the path
		 * @param pathToChildren - Map of paths to their child managers
		 * @returns void
		 * @todo throw {Error} If the path is invalid or if the parent path cannot be determined
		 * 
		 */
		protected registerParentChildRelationship(
			path: string, 
			pathSeparator: string,
			pathToChildren: Map<string, string[]>
		): void {
			const normalizedPath = this.normalizePath(path, pathSeparator);
			const segments = normalizedPath
				.split(pathSeparator)
				.map(segment => segment?.trim()) // Trim whitespace from segments
				.filter(segment => segment); // Remove empty segments
			
			if (segments.length > 1) {
					segments.pop(); // Remove last segment to get parent path
					const parentPath = segments.join(pathSeparator);
			
					if (!pathToChildren.has(parentPath)) {
							pathToChildren.set(parentPath, []);
					}
					const normalizedChildPath = this.normalizePath(path, pathSeparator);
    				pathToChildren.get(parentPath)!.push(normalizedChildPath);
			}
		}
		
		//------------------------------------ UTILITY METHODS ------------------------------------//
		
		/*
		 * Get a unique identifier for a manager
		 *
		 * @param manager - The domain state manager to identify
		 * @returns A unique identifier string for the manager
		 * @todo Throw {Error} If the manager does not have a unique identifier
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
		 *
		 * @param manager - The domain state manager to get the path for
		 * @returns The path of the manager, or undefined if not found
		 * @todo Throw {Error} If the manager does not have a path
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
		 * Normalize a path by removing leading/trailing separators, trimming segments and converting to lowercase.
		 * 
		 * @param path - The path to normalize
		 * @param separator - The separator used in the path
		 * @returns The normalized path
		 * 
		 */
		protected normalizePath(path: string, separator: string = '.'): string {
			const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			return path
					.split(separator) // Split the path into segments using the separator
					.map(segment => segment.trim()) // Trim whitespace from segments
					.filter(Boolean) // Remove empty segments
					.join(separator) // Join segments back together
					.replace(new RegExp(`^${escapedSeparator}+|${escapedSeparator}+$`, 'g'), '') // Remove leading/trailing separators
					.replace(new RegExp(`${escapedSeparator}+`, 'g'), separator) // Normalize multiple separators
					.toLowerCase(); // Convert to lowercase for consistency
		}
		
		/*
		 * Serialize the hierarchy to a JSON-friendly format for inspection and debugging.
		 *
		 * @param hierarchy - The hierarchy map to serialize
		 * @returns A JSON-friendly object representing the hierarchy
		 * 
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