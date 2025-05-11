import DomainStateManager from "../helpers/domain-state-manager.class";
import { DomainPathExtractorOptions } from "./domain-path-extractor-options.model";

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
 * @param options - Optional configuration for the path extraction process
 *   The extractor should provide defaults internally so clients can use it with no or partial options.
 * @returns A dot-separated string representing the manager's position in the hierarchy (e.g., "app.conditioning")
 *   Skips the file name in favour of the enclosing directory name, plus 'app' for the root.
 *
 * @see {@link filePathExtractor} for a default implementation that uses the file system location.
 */
export type DomainPathExtractor = (
	manager: DomainStateManager,
	options?: Partial<DomainPathExtractorOptions>,
) => string;
export default DomainPathExtractor;
