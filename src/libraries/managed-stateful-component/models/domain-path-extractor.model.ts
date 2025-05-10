import DomainStateManager from "../helpers/domain-state-manager.class";

/**
 * Function that determines the hierarchical location of a {@link DomainStateManager} in the application's domain tree.
 *
 * DomainPathExtractor is a key part of the automatic domain hierarchy building process. It generates
 * a dot-notation path (e.g., "app.user.profile") that:
 *
 * 1. Establishes parent-child relationships between domain state managers
 * 2. Creates a consistent, navigable structure for health reporting and monitoring
 * 3. Enables automatic component registration without manual wiring
 *
 * Paths can be derived through various strategies:
 * - File system location (recommended for maintainability)
 * - Module metadata
 * - Explicit configuration via virtualPath option
 * - Class naming conventions
 *
 * @param manager - The domain state manager to locate in the hierarchy
 * @param appRootName - Root prefix for all paths (default: "app")
 * @returns A dot-separated string representing the manager's position in the hierarchy (e.g., "app.conditioning")
 *   Skips the file name in favour of the enclosing directory name, plus 'app' for the root.
 *
 * @example
 * // File system location strategy (automatically reflects code organization)
 * export const filePathExtractor: DomainPathExtractor = (manager: DomainStateManager, appRootName: string = 'app'): string => {
	// The file location must be attached to the manager instance
	const filePath = (manager as any).__filename;
	
	// If file path is missing, fall back to constructor name
	if (!filePath) {
		return manager.constructor.name.replace(/Manager$/, '').toLowerCase();
	}
	
	// Extract portion after project root to create hierarchical path
	const projectRoot = 'fitnessapp-conditioning-service';
	const relativePath = filePath.split(projectRoot)[1];
	
	// Create dotted path, removing file extension and normalizing names
	let normalizedPath = (appRootName + relativePath)
		.replace(/\\/g, '.') // Replace backslashes with dots for Windows compatibility
		.replace(/\//g, '.') // Replace slashes with dots
		.replace(/^\./, '') // Remove leading dot
		.replace(/\.$/, '') // Remove trailing dot
		.replace(/\.js$/, '') // Remove .js extension
		.replace(/\.ts$/, '') // Remove .ts extension
		.replace(/\.dist\.src\./g, '.') // Remove .dist.src.
		.toLowerCase();
	
	// Remove the file name from the path - this is the key change
	const pathSegments = normalizedPath.split('.');
	if (pathSegments.length > 1) {
		// Remove the last segment (file name)
		pathSegments.pop();
		normalizedPath = pathSegments.join('.');
	}
	
	console.log("filePathExtractor", normalizedPath);
	return normalizedPath;
};
 */
export type DomainPathExtractor = (manager: DomainStateManager, appRootName?: string) => string;
export default DomainPathExtractor;
