/** Options for the DomainPathExtractor function */

export interface DomainPathExtractorOptions {
	/**
	 * The root name for the application in the generated path (default: 'app')
	 */
	appRootName: string;

	/**
	 * The separator used to create the hierarchical path (default: period, '.')
	 */
	separator: string;
}
