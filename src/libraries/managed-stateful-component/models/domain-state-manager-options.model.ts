/** Options for the {@link DomainStateManager} */

export interface DomainStateManagerOptions {
	/** Optional virtual path for the domain, used for hierarchical state management.
	 *
	 * When provided, enables override of automatic path inference by {@link DomainPathExtractor}s.
	 * Useful for special cases where components need custom positioning
	 * in the domain hierarchy regardless of their actual file location.
	 *
	 * Format: Dot-separated path segments (e.g., "app.features.user")
	 */
	virtualPath?: string;

}
export default DomainStateManagerOptions;