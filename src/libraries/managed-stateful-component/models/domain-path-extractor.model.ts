import DomainStateManager from "../helpers/domain-state-manager.class";

/** Function that determines the hierarchical location of a {@link DomainStateManager} in the application's domain tree.
 *
 * DomainPathExtractor is a key part of the automatic domain hierarchy building process. It generates
 * a dot-notation path (e.g., "app.user.profile") that:
 *
 * 1. Establishes parent-child relationships between domain managers
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
 *
 * @example
 * // File system location strategy (automatically reflects code organization)
 * const filePathExtractor: DomainPathExtractor = (manager, appRootName = 'app') => {
 *   // Get filepath attached by discovery service
 *   const filePath = (manager as any).__filename;
 *
 *   // Fallback for testing or unknown filepath
 *   if (!filePath) {
 *     return `${appRootName}.${manager.constructor.name.replace(/Manager$/, '').toLowerCase()}`;
 *   }
 *
 *   // Convert filepath to dotted hierarchy
 *   const projectRoot = 'fitnessapp-conditioning-service';
 *   const relativePath = filePath.split(projectRoot)[1];
 *
 *   return appRootName + relativePath
 *     .replace(/\\/g, '.')
 *     .replace(/\//g, '.')
 *     .replace(/\.ts$/, '')
 *     .replace(/\.module/g, '')
 *     .toLowerCase();
 * };
 */
export type DomainPathExtractor = (manager: DomainStateManager, appRootName?: string) => string;
export default DomainPathExtractor;
