import { DomainPathExtractorOptions } from '../../models/domain-path-extractor-options.model';


export interface FilePathExtractorOptions extends DomainPathExtractorOptions {
	/**
	 * The root directory of the source code (default: process.cwd())
	 */
	sourceRoot: string;
}

export default FilePathExtractorOptions;