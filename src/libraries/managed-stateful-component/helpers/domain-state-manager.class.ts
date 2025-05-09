import DomainStateManagerOptions from "./domain-state-manager-options.model";
import ManagedStatefulComponent from "../models/managed-stateful-component.model";
import ManagedStatefulComponentMixin from "../mixins/managed-stateful-component.mixin";

/** Represents a domain-specific state container that manages components within
 * a logical boundary of the application.
 * 
 * This class bridges the gap between framework-specific module systems and
 * framework-agnostic state management by:
 * 
 * 1. Serving as a discoverable proxy for framework specific domain containers (e.g., NestJS modules)
 * 2. Establishing hierarchical relationships based on customizable DomainPathExtractors
 *    (e.g. file structure or virtual paths)
 * 3. Managing the lifecycle and state of components within its domain
 * 4. Enabling the streaming of aggregated state information up the component hierarchy,
 *    using the {@link ManagedStatefulComponentMixin}'s built-in features.
 * 5. Enabling library consumers to focus on simply registering their components.
 * 
 * DomainStateManager solves the practical challenge of accessing framework module
 * instances by creating parallel, discoverable containers that can be automatically
 * wired together e.g., based on their location in the project.
 * 
 * @example
 * // Create a domain manager for the user feature
 * @Injectable()
 * export class UserDomainManager extends DomainStateManager {
 *   constructor(
 *     private userService: UserService,
 *     private userRepository: UserRepository
 *   ) {
 *     super();
 *     
 *     // Register domain components
 *     this.registerDomainComponent(userService);
 *     this.registerDomainComponent(userRepository);
 *   }
 * }
 */
export abstract class DomainStateManager extends ManagedStatefulComponentMixin(class {}) {
	protected readonly options?: DomainStateManagerOptions;
	
	/** Creates a new instance of the DomainStateManager.
	 * 
	 * @param options - Optional configuration for the domain state manager.
	 * @returns A new instance of the DomainStateManager.
	 */
	public constructor(options?: DomainStateManagerOptions) {
		super();
		this.options = options;
	}	
}
export default DomainStateManager;