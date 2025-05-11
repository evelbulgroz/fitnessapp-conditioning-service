import DomainStateManagerOptions from "../models/domain-state-manager-options.model";
import ManagedStatefulComponent from "../models/managed-stateful-component.model";
import {ManagedStatefulComponentMixin, MSC_PREFIX} from "../mixins/managed-stateful-component.mixin";

/**
 * Domain-specific state container that manages components within a logical boundary of the application
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
 * It's use is optional but may be necessary for some applications, e.g. when using
 * a framework that does not provide a module system (e.g. React), or when 
 * using a framework that does not provide a way to access the module instances
 * (e.g. NestJS).
 * 
 * @example
 * // Create a domain manager for the user feature
 * // In a NestJS application, this would co-located with the user module
 * @Injectable()
 * export class UserDomainManager extends DomainStateManager {
 *   constructor(
 *     private userService: UserService,
 *     private userRepository: UserRepository,
 *     options?: DomainStateManagerOptions,
 *   ) {
 *     super(options);
 *     
 *     // Register domain components
 *     this.registerDomainComponent(userService);
 *     this.registerDomainComponent(userRepository);
 *   }
 * }
 */
export class DomainStateManager extends ManagedStatefulComponentMixin(class {}) implements ManagedStatefulComponent {
	/**
	 * Creates a new instance of the DomainStateManager.
	 * 
	 * @param options - Optional configuration for the domain state manager. Will be merged into the internal mixin options.
	 * @returns A new instance of the DomainStateManager.
	 *
	 */
	public constructor(options?: DomainStateManagerOptions) {
		super();
		this[`${MSC_PREFIX}mergeOptions`](options ?? {}); // merge options into mixin
	}	
}
export default DomainStateManager;