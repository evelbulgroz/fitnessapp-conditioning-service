import { normalize, sep } from 'path';

import domainPathExtractor from "../../models/domain-path-extractor.model";
import DomainStateManager from "../domain-state-manager.class";
import FilePathExtractorOptions from './file-path-extractor-options.model';

/**
 * Extract domain path from file location in project structure
 * 
 * This function generates a hierarchical path based on the file location of the domain state manager.
 * It normalizes the file path to ensure consistent formatting across different operating systems.
 * It also allows for customization of the application root name, source root, and separator
 * used in the path.
 * 
 * The function is provided as a default {@DomainPathExtractor} implementation that should
 * suffice for most use cases.
 * 
 * The generated path is structured as follows:
 * - The first segment is the application root name (default: 'app')
 * - The subsequent segments are derived from the file path of the domain state manager,
 *   normalized to lowercase and separated by the specified separator.
 * 
 * @example
 * ```
 * filePathExtractor(
 * 	manager, // instance of DomainStateManager
 * 	appRootName = 'app',
 * 	sourceRoot = 'd:\\version-control\\projects\\fitnessapp-conditioning-service',
 * 	separator = '.'
 * );
 * // returns: 'app.src.conditioning.conditioningdomainstatemanager'
 * ```
 * 
 * @param {DomainStateManager} manager - The domain state manager instance
 * @param {string} appRootName - The name of the application root in the generated path (default: 'app')
 * @param {string} sourceRoot - The root directory of the source code (default: process.cwd())
 * @param {string} separator - The separator used to create the hierarchical path (default: period, '.')
 * @returns {string} - The hierarchical path of the domain state manager
 */
export const filePathExtractor: domainPathExtractor = (
	manager: DomainStateManager,
	extractorOptions: Partial<FilePathExtractorOptions>
): string => {
	// Merge default options with any provided options
	const options = {
		...{ // Default options
		appRootName: 'app',
		sourceRoot: process.cwd(),
		separator: '.',
		},
		...(extractorOptions || {}), // Provided options
	} as FilePathExtractorOptions;

	// If file path is missing, fall back to constructor name
	const filePath = (manager as any).__filename;
	if (!filePath) {
		return manager.constructor.name.replace(/Manager$/, '').toLowerCase();
	}
	
	// Normalize the paths to handle different OS path formats
	const normalizedFilePath = normalize(filePath);
	const normalizedSourceRoot = normalize(options.sourceRoot);
	
	// Extract portion after source root to create hierarchical path
	let relativePath = '';
	if (normalizedFilePath.startsWith(normalizedSourceRoot)) {
		relativePath = normalizedFilePath.substring(normalizedSourceRoot.length);
	} else {
		// If file is not under source root, just use the file path
		relativePath = normalizedFilePath;
	}
	
	// Create separated path, removing file extension and normalizing names
	// Start with the appRootName
	let pathSegments = [options.appRootName];
	
	// Split the path into segments using the OS-specific separator
	const relativeSegments = relativePath
		.split(sep)
		.filter(segment => segment) // Remove empty segments
		.map(segment => {
			// Process each segment to normalize it
			let processed = segment
				.replace(/\.js$/, '') // Remove .js extension
				.replace(/\.ts$/, '') // Remove .ts extension
				.toLowerCase();
			
			// Handle Windows drive letters by removing the colon
			// but ONLY when it's a Windows drive letter pattern like "d:"
			if (/^[a-z]\:$/i.test(processed)) {
				processed = processed.replace(':', '');
			}
			
			return processed;
		});
	
	// Only remove the last segment if it looks like a file name
	// (doesn't have a file extension but the path isn't ending with a directory separator)
	const isLastSegmentFile = !normalizedFilePath.endsWith(sep) && 
							 relativeSegments.length > 0 && 
							 !relativeSegments[relativeSegments.length - 1].includes('.');
	
	if (isLastSegmentFile && relativeSegments.length > 0) {
		relativeSegments.pop();
	}
	
	// Combine all segments
	pathSegments = [...pathSegments, ...relativeSegments];
	
	// Create a safe regex pattern for the separator
	// Need to escape special regex characters
	const escapedSeparator = options.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	
	// Join segments with the provided separator and normalize multiple separators
	let result = pathSegments.join(options.separator)
		.replace(new RegExp(`${escapedSeparator}+`, 'g'), options.separator) // Replace multiple separators
		.replace(new RegExp(`^${escapedSeparator}`), '') // Remove leading separator
		.replace(new RegExp(`${escapedSeparator}$`), ''); // Remove trailing separator
	
	return result;
};

export default filePathExtractor;