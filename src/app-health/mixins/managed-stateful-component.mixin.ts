import { BehaviorSubject, filter, firstValueFrom, Observable, take, tap } from 'rxjs';

import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponent from '../models/managed-stateful-component';

/** A mixin that provides a standard implementation of the ManagedStatefulComponent interface.
 * @param Parent The immediate parent class of the target class using this mixin, or `class {}` if the target class does not inherit from any other class.
 * @typeparam TParent The type of the parent class
 * @returns A class that implements ManagedStatefulComponent and extends the provided parent class (if any)
 * @remark This mixin inserts a standard implementation of the ManagedStatefulComponent interface into the existing class hierarchy, which it otherwise leaves intact.
 * @remark Anonymous classes in TypeScript cannot have non-public members. Instead, members not intended for the public API are marked as `@internal`.
 * - It is up to clients to respect this convention, as it is not enforced by TypeScript.
 * @todo Figure out how to support logging without introducing a Logger dependency, and without conflicting with e.g. Repository' logs$ Observable
 * 
 * @example Class that does not inherit and uses this mixin:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(class {}) {
 *    // Implement the required methods and properties here
 *    public async executeInitialization(): Promise<void> {
 *      // Component-specific initialization logic goes here
 *    }
 *    public async executeShutdown(): Promise<void> {
 *      // Component-specific shutdown logic goes here
 *    }
 * }
 * ```
 * 
 * @example Class that inherits from a parent class and uses this mixin:
 * ```typescript
 * class MyComponent extends ManagedStatefulComponentMixin(ParentClass) {
 *    // Implement the required methods and properties here
 *    public async executeInitialization(): Promise<void> {
 *      // Component-specific initialization logic goes here
 *    }
 *    public async executeShutdown(): Promise<void> {
 *      // Component-specific shutdown logic goes here
 *    }
 *  }
 * ```
 *
 * IMPLEMENTATION REQUIREMENTS
 * Classes using this mixin must implement two public methods:
 * `executeInitialization(): Promise<void>` - Component specific logic to be executed during initialization, called from `initialize()`
 * `executeShutdown(): Promise<void>` - Component specific logic to be executed during shutdown, called from `shutdown()`
 * 
 * Classes using this mixin must also implement a `logger` property of type Logger compatible with the `@evelbulgroz/logger` API.
 * This logger will be used for logging state changes and errors during initialization and shutdown.
 * 
 * INHERITANCE CONSIDERATIONS
 * - If the parent class already has `initialize()` or `shutdown()` methods, the mixin will shadow them.
 * - If your parent class has its own initialization or shutdown logic, you MUST call the parent methods 
 *   explicitly from your `executeInitialization()` or `executeShutdown()` implementations, e.g.:
 *   ```typescript
 *   public executeInitialization(): Promise<void> {
 *     // First call parent class initialization if needed
 *     await super.initialize();
 *     
 *     // Then do component-specific initialization
 *     // ...
 *     
 *     return Promise.resolve();
 *   }
 *   ```
 * 
 * CAUTIONS
 * - Properties `stateSubject`, `initializationPromise` and `shutdownPromise` are not intended for public access, 
 *   but must be marked as public to be accessible to the mixin.
 * - The mixin's implementation of `initialize()` and `shutdown()` does NOT automatically call parent class methods 
 *   with the same name.
 * - Avoid applying this mixin to classes that already implement the ManagedStatefulComponent interface (e.g. using this mixin), as this will introduce unnessesary complexity and potential conflicts.
 * 
 * TYPESAFETY
 * When using with multiple inheritance or complex class hierarchies, you may need to use declaration merging to ensure proper TypeScript type checking:
 * ```typescript
 * interface MyClass extends ReturnType<typeof ManagedStatefulComponentMixin> {}
 * ```
 */
export function ManagedStatefulComponentMixin<TParent extends new (...args: any[]) => any>(Parent: TParent) {
	abstract class ManagedStatefulComponentClass extends Parent implements ManagedStatefulComponent {
		// State management properties

		public /* @internal */  readonly stateSubject = new BehaviorSubject<ComponentStateInfo>({ 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		});
		
		public readonly state$: Observable<ComponentStateInfo> = this.stateSubject.asObservable();
		
		/** Get the current state of the component
		 * @returns The current state information
		 */
		public getState(): ComponentStateInfo {
			return { ...this.stateSubject.value };
		}

		/** Get the current state of the component asynchronously
		 * @returns A promise that resolves to the current state information
		 * @throws Error if the state cannot be retrieved
		 */
		/*public async getStateAsync(): Promise<ComponentStateInfo> {
			const latestState = await firstValueFrom(this.state$.pipe(take(1)));
			return { ...latestState };
		}
		*/

		public getStateAsync(): Promise<ComponentStateInfo> {
			return new Promise((resolve, reject) => {
				this.state$.subscribe({
					next: (state) => {
						resolve(state);
					},
					error: (err) => {
						reject(err);
					}
				});
			});
		}
		
		
		
		/** Initialize the component if it is not already initialized
		 * @returns Promise that resolves when the component is initialized
		 * @throws Error if initialization fails
		 * @remark Expects the implementing class to provide a `executeInitialization(): Promise<void>` method containing the component-specific initialization logic
		 * @remark Transitions state to `INITIALIZING` during the process and to `OK` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during initialization
		 * @remark If the component is already initialized, resolves immediately
		 */
		public initialize(): Promise<void> {
			// If already initialized, resolve immediately
			if (this.stateSubject.value.state !== ComponentState.UNINITIALIZED) {
				return Promise.resolve();
			}

			// If initialization is already in progress, return the existing promise
			if (this.initializationPromise) {
				return this.initializationPromise;
			}

			// Set the internal state to indicate initialization in progress
			this.stateSubject.next({
				name: this.constructor.name,
				state: ComponentState.INITIALIZING,
				reason: 'Component initialization in progress',
				updatedOn: new Date()
			});
			
			// Create a new initialization promise
			this.initializationPromise = new Promise<void>(async (resolve, reject) => {
				try {
					await this.executeInitialization();

					// Create a promise that resolves when the state$ emits ComponentState.OK
					// This is to ensure that the state is updated before resolving the promise
					const stateUpdatePromise = firstValueFrom(
						this.state$.pipe(
						filter(state => state.state === ComponentState.OK),
						take(1)
						)
					);
					
					// Update state to indicate successful initialization
					this.stateSubject.next({
						name: this.constructor.name,
						state: ComponentState.OK,
						reason: 'Component initialized successfully',
						updatedOn: new Date()
					});

					// Wait for the state update to propagate through the observable chain
    				await stateUpdatePromise;

					console.debug(`Component initialized successfully: ${this.stateSubject.getValue().state}`, this.constructor.name); // correctly logs OK state
					
					resolve();
				} 
				catch (error) {
					// Update state to indicate initialization failure
					this.stateSubject.next({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component initialization failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});

					// Create a promise that resolves when the state$ emits ComponentState.FAILED
					// This is to ensure that the state is updated before rejecting the promise
					const stateUpdatePromise = firstValueFrom(
						this.state$.pipe(
						filter(state => state.state === ComponentState.FAILED),
						take(1)
						)
					);

					// Wait for the state update to propagate through the observable chain
					await stateUpdatePromise;

					// Reject the promise with the error				
					reject(error);
				}
				finally {
					this.initializationPromise = undefined; // Reset initialization promise
				}
			});

			return this.initializationPromise;
		}
		public /* @internal */  initializationPromise: Promise<void> | undefined = undefined;
		
		
		/** Checks if the component is ready to serve requests
		 * @returns Promise that resolves to true if ready, false otherwise
		 * @throws Error if the component is not ready
		 * @remark May trigger initialization if the component supports lazy initialization
		 * @remark A component is typically ready when in `OK` or `DEGRADED` state
		 */
		public async isReady(): Promise<boolean> {
			return new Promise(async (resolve) => {
				if (this.getState().state === ComponentState.UNINITIALIZED) {
					this.logger.log(`Component is not initialized, initializing...`, this.constructor.name);
					try {
						await this.initialize();
						resolve(true);
					}
					catch (error) {
						this.logger.error(`Initialization failed:`, error, this.constructor.name);
						resolve(false);
					}
				} else {
					resolve(
						this.getState().state === ComponentState.OK || 
						this.getState().state === ComponentState.DEGRADED
					);
				}
			});
		}
		
		/** Shuts down the component and cleans up any resources it is using
		 * @returns Promise that resolves when the component is shut down
		 * @throws Error if shutdown fails
		 * @remark Expects the implementing class to provide a `executeShutdown(): Promise<void>` method containing the component-specific shutdown logic
		 * @remark Transitions state to `SHUTTING_DOWN` during the process and to `SHUT_DOWN` when complete
		 * @remark Handles concurrent calls by returning the same promise for all callers during shutdown
		 * @remark If the component is already shut down, resolves immediately
		 */
		public shutdown(): Promise<void> {
			// If already shut down, return immediately
			if (this.stateSubject.value.state === ComponentState.SHUT_DOWN) {
				return Promise.resolve();
			}

			// If shutdown is already in progress, return the existing promise
			if (this.shutdownPromise) {
				return this.shutdownPromise;
			}

			// Set the internal state to indicate shutdown in progress
			this.stateSubject.next({
				name: this.constructor.name,
				state: ComponentState.SHUTTING_DOWN,
				reason: 'Component shutdown in progress',
				updatedOn: new Date()
			});

			// Create a new shutdown promise
			this.shutdownPromise = new Promise<void>(async (resolve, reject) => {
				try {
					await this.executeShutdown();
					
					// Update state to indicate successful shutdown
					this.stateSubject.next({
						name: this.constructor.name,
						state: ComponentState.SHUT_DOWN,
						reason: 'Component shut down successfully',
						updatedOn: new Date()
					});
					
					resolve();
				} 
				catch (error) {
					// Update state to indicate shutdown failure
					this.stateSubject.next({
						name: this.constructor.name,
						state: ComponentState.FAILED,
						reason: `Component shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
						updatedOn: new Date()
					});
					
					reject(error);
				}
				finally {
					this.shutdownPromise = undefined; // Reset shutdown promise
				}
			});

			return this.shutdownPromise;
		}
		public /* @internal */  shutdownPromise: Promise<void> | undefined = undefined;
		
	}
	
	return ManagedStatefulComponentClass;
}

export default ManagedStatefulComponentMixin;