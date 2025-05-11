import DomainPathExtractor from "../../models/domain-path-extractor.model";
import DomainStateManager from "../domain-state-manager.class";

/**
 * Extract domain path from file location in project structure
 *
 * This function is used to parse the hierarchical path of a domain state manager
 * within the application structure based on its file location.
 * 
 * Default implementation {@link DomainPathExtractor} for most situations when
 * the file location is used to determine the path.
 *
 * Note: The file location must be attached to the manager instance in the `__filename` property.
 * 
 * @todo Make project root configurable in the constructor
 * @todo Replace multiple path separators with a single dot
 * @todo Consider using Node.js `path` module for path normalization and manipulation
 */
export const filePathExtractor: DomainPathExtractor = (manager: DomainStateManager, appRootName: string = 'app'): string => {
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
	
	return normalizedPath;
};
export default filePathExtractor;