import DomainStateManager from "./domain-state-manager.class";

/** Registry of component state managers for different domains.
 * 
 * Enables the creation and retrieval of domain-specific state managers that
 * track component lifecycles and their hierarchical relationships.
 * 
 * This class implements the Singleton pattern to ensure consistent state 
 * management across the application. It works with DomainStateManager 
 * instances to organize components by their functional domains.
 * 
 * Intended to be used as a static readonly singleton property of
 * {@link ManagedStatefulComponentMixin} to preserve app-wide coherence
 * of state management while maintaining framework independence.
 * 
 * Supports app-wide health checks and monitoring by providing an
 * aggregated state snapshot that preserves hierarchical domain context,
 * making it easy to identify which domains contain problematic components.
 */
export class ComponentStateRegistry {
	private static instance: ComponentStateRegistry;
	private domainManagers = new Map<string, DomainStateManager>();
	
	// Singleton access
	public static getInstance(): ComponentStateRegistry {
		if (!ComponentStateRegistry.instance) {
			ComponentStateRegistry.instance = new ComponentStateRegistry();
		}
		return ComponentStateRegistry.instance;
	}
	
	public getOrCreateDomainManager(domain: string): DomainStateManager {
		if (!this.domainManagers.has(domain)) {
			//this.domainManagers.set(domain, new DomainStateManager(domain));
		}
		return this.domainManagers.get(domain)!;
	}
	
	// Support for health checks and monitoring
	public getFullStateSnapshot(): Record<string, any> {
		const result: Record<string, any> = {};
		this.domainManagers.forEach((manager, domain) => {
			result[domain] = manager.getStateSnapshot();
		});
		return result;
	}
}
export default ComponentStateRegistry;