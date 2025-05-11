import { DomainPathExtractorOptions } from "../models/domain-path-extractor-options.model";
import DomainPathExtractor from "../models/domain-path-extractor.model";
import DomainStateManager from "./domain-state-manager.class";
import filePathExtractor from "./extractors/file-path-extractor";

/**
 *  Utility class responsible for automatically wiring domain state managers into a hierarchical structure.
 * 
 * @todo Refactor to use internal mixin options for path extraction
 *
 */
export class DomainHierarchyWirer {
		//--------------------------------------- PUBLIC API ----------------------------------------//
		
		/** 
		 * Wire domain state managers into a complete hierarchical structure.
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
		 * Filter input to ensure we only process DomainStateManager instances
		 */
		protected filterDomainManagers(managers: any[]): DomainStateManager[] {
			return managers
				.filter(provider => provider instanceof DomainStateManager || 
							(provider.instance && provider.instance instanceof DomainStateManager))
				.map(provider => provider instanceof DomainStateManager ? provider : provider.instance);
		}
		
		/*
		 * Build a hierarchical relationship map between domain state managers based on their paths.
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
			
			// Handle flat structure case (all managers at same level)
			if (result.size === 0 && managers.length > 0) {
					return this.createFallbackHierarchy(managers);
			}
			
			return result;
		}
		
		/*
		 * Extract path mappings from managers
		 */
		protected extractPathMappings(
			managers: DomainStateManager[],
			pathExtractor: DomainPathExtractor,
			extractorOptions: Partial<DomainPathExtractorOptions> = { appRootName: 'app', separator: '.' }
		): { pathToManager: Map<string, DomainStateManager>, pathToChildren: Map<string, string[]> } {
			const pathToManager = new Map<string, DomainStateManager>();
			const pathToChildren = new Map<string, string[]>();
			
			for (const manager of managers) {
					const path = pathExtractor(manager, extractorOptions).toLowerCase(); // Normalize to lowercase
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
					
					if (childManagers.length > 0) {
							result.set(manager, childManagers);
					}
			}
			
			return result;
		}
		
		/*
		 * Create a fallback hierarchy when all managers are at the same level
		 */
		protected createFallbackHierarchy(
			managers: DomainStateManager[]
		): Map<DomainStateManager, DomainStateManager[]> {
			console.warn('Flat domain structure detected - creating artificial hierarchy for monitoring');
			
			if (managers.length === 0) {
					return new Map();
			}
			
			// Find or create a root manager
			const rootManager = managers[0];
			
			// Make all other managers children of the root
			const children = managers.filter(m => m !== rootManager);
			
			return new Map([[rootManager, children]]);
		}
		
		/*
		 * Register components based on the hierarchy map
		 */
		protected registerHierarchicalComponents(
			hierarchy: Map<DomainStateManager, DomainStateManager[]>
		): void {
			for (const [parentManager, childManagers] of hierarchy) {
					for (const childManager of childManagers) {
							parentManager.registerSubcomponent(childManager);
					}
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