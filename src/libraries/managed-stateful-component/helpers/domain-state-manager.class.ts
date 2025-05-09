import { v4 as uuidv4 } from "uuid";
import ManagedStatefulComponent from "../models/managed-stateful-component.model";

/** State manager for a domain, managing components and their hierarchical relationships.
 * 
 * This class provides a namespace-specific container for components belonging to a 
 * particular domain or feature area within the application. It serves as a middle layer 
 * between individual components and the global ComponentStateRegistry.
 * 
 * Key features:
 * - Assigns unique IDs to registered components within the domain
 * - Tracks parent-child relationships between components
 * - Maintains the hierarchical context of component states
 * - Provides state snapshots that preserve the domain structure
 * 
 * Intended for use in conjunction with {@link ComponentStateRegistry} to create a
 * framework-agnostic state management system that supports hierarchical health
 * reporting while keeping client code simple.
 * 
 * @example
 * // Register components with domain manager
 * const userDomain = new DomainStateManager('user');
 * const parentId = userDomain.registerComponent(userService);
 * const childId = userDomain.registerComponent(userRepository);
 * userDomain.registerHierarchy(parentId, childId);
 */
export class DomainStateManager {
	private components = new Map<string, ManagedStatefulComponent>();
	private hierarchyMap = new Map<string, string[]>(); // parent -> children
	
	constructor(private readonly domain: string) {}
	
	registerComponent(component: ManagedStatefulComponent, id?: string): string {
		const componentId = id || `${this.domain}_${component.constructor.name}_${uuidv4()}`;
		this.components.set(componentId, component);
		return componentId;
	}
	
	registerHierarchy(parentId: string, childId: string): void {
		if (!this.hierarchyMap.has(parentId)) {
			this.hierarchyMap.set(parentId, []);
		}
		this.hierarchyMap.get(parentId)!.push(childId);
	}
	
	getStateSnapshot(): any {
		// Build hierarchical state representation
		// ...
	}
}
export default DomainStateManager;