import DomainPathExtractor from "../models/domain-path-extractor.model";
import DomainStateManager from "./domain-state-manager.class";

/** Utility class responsible for automatically wiring domain state managers into a hierarchical structure.
 * 
 * DomainHierarchyWirer is the "glue" that connects independent domain state managers into a 
 * cohesive hierarchy without requiring manual registration. It:
 * 
 * 1. Takes a collection of domain managers across the application
 * 2. Determines their hierarchical relationships using path extractors
 * 3. Establishes parent-child connections by registering subcomponents
 * 4. Creates a complete state management tree that reflects your application structure
 * 
 * This automated wiring enables consolidated health monitoring, state propagation, and 
 * hierarchical lifecycle management with minimal configuration.
 * 
 * It fails gracefully if the domain managers are not perfectly registered in the application,
 * so that the most complete health monitoring possible can be achieved. Note that this may hide
 * some issues in the application: check your health endpoints to see if all domains are
 * registered in the correct hierarchy.
 * 
 * Typical usage:
 * ```typescript
 * // In your application bootstrap
 * const wirer = new DomainHierarchyWirer();
 * const managers = discoverDomainManagers(); // Framework-specific discovery
 * 
 * // Wire managers using file-based hierarchy
 * await wirer.wireDomains(managers, filePathExtractor);
 * ```
 * 
 * @see {@link DomainStateManager} for details on individual domain managers
 * @see {@link DomainPathExtractor} for path determination strategies
 * 
 * @todo Refactor so that flat structure returns a tree structure with all nodes branching from the default root
 */
export class DomainHierarchyWirer {
	//--------------------------------------- PUBLIC API ----------------------------------------//
	
	/** Wire domain state managers into a complete hierarchical structure.
	 *
	 * This method serves as the entry point for establishing the entire component hierarchy by:
	 * 1. Processing domain managers to extract their hierarchical positions
	 * 2. Building parent-child relationships based on path patterns (e.g., 'app.user' is a child of 'app')
	 * 3. Registering child managers as subcomponents of their parents
	 * 4. Creating a fully connected component tree that enables state propagation
	 * 
	 * After this method completes, all domain managers will be properly connected in a hierarchy
	 * that matches their logical organization in the application, enabling aggregated state
	 * monitoring and coordinated lifecycle management.
	 * 
	 * @param managers - An array of domain state managers to organize into a hierarchy
	 * @param pathExtractor - A function that determines each manager's hierarchical position
	 * @param pathSeparator - The character(s) that separate path segments (default is '.')
	 * @returns A promise that resolves when all hierarchical connections are established
	 * 
	 * @example
	 * // In a NestJS application's bootstrap phase:
	 * const wirer = new DomainHierarchyWirer();
	 * const managers = discoveryService.getProviders()
	 *   .filter(p => p.instance instanceof DomainStateManager)
	 *   .map(p => p.instance);
	 * 
	 * await wirer.wireDomains(managers, filePathExtractor);
	 */
	public async wireDomains(
		managers: DomainStateManager[],
		pathExtractor: DomainPathExtractor,
		pathSeparator: string = "."
	): Promise<void> {
		const domainManagers = managers
			.filter(provider => provider.instance instanceof DomainStateManager)
			.map(provider => provider.instance as DomainStateManager);
		
		// Build hierarchy based on domain name patterns (e.g., 'app.user')
		const hierarchy = this.buildHierarchy(domainManagers, pathExtractor, pathSeparator);
		
		// Register child domains with their parents
		for (const [parentManager, childManagers] of hierarchy) {
			for (const childManager of childManagers) {
				parentManager.registerSubcomponent(childManager);
			}
		}
	}

	//------------------------------------ PROTECTED METHODS ------------------------------------//
	
	/** Build a hierarchical relationship map between domain state managers based on their paths.
	 * 
	 * This method implements a three-step algorithm to transform a flat list of managers into a
	 * hierarchical structure:
	 * 
	 * 1. Path extraction: Determines each manager's position in the hierarchy using the path extractor
	 * 2. Relationship mapping: Identifies parent-child relationships by analyzing path segments
	 * 3. Hierarchy construction: Creates a mapping of parent managers to their direct children
	 * 
	 * For example, a manager with path 'app.user.profile' would be identified as a child of 'app.user',
	 * which in turn would be a child of 'app'.
	 * 
	 * @param managers - Domain state managers to organize into a hierarchy
	 * @param pathExtractor - Function that extracts each manager's hierarchical path
	 * @param pathSeparator - Character(s) that separate path segments (typically '.')
	 * @returns A parent-to-children mapping that represents the domain hierarchy
	 * 
	 * @example
	 * // With these paths:
	 * // - app (root)
	 * // - app.user (child of app)
	 * // - app.conditioning (child of app)
	 * // The result will connect app manager to both user and conditioning managers
	 * 
	 * @todo Normalize paths to lower case to avoid case sensitivity issues
	 */
	protected buildHierarchy(
		managers: DomainStateManager[],
		pathExtractor: DomainPathExtractor,
		pathSeparator: string
	): Map<DomainStateManager, DomainStateManager[]>
	{
		const result = new Map<DomainStateManager, DomainStateManager[]>();
		const pathToManager = new Map<string, DomainStateManager>();
		const pathToChildren = new Map<string, string[]>();
		
		// Step 1: Extract paths and build path-to-manager mapping
		for (const manager of managers) {
			const path = pathExtractor(manager);
			pathToManager.set(path, manager);
			
			// Initialize empty children array for each path
			if (!pathToChildren.has(path)) {
				pathToChildren.set(path, []);
			}
			
			// Step 2: Determine parent path and register this path as its child
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
		
		// Step 3: Build the hierarchy map of parent managers to child managers
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
}
export default DomainHierarchyWirer;