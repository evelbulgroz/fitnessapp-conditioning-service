import { BehaviorSubject, Observable } from 'rxjs';
import { Logger } from '@evelbulgroz/logger';

import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponent from '../models/managed-stateful-component';

/** A mixin that provides a standard implementation of the ManagedStatefulComponent interface.
 * @param Base The base class to extend
 * @returns A class that extends Base and implements ManagedStatefulComponent
 */
export function ManagedStatefulComponentMixin<TBase extends new (...args: any[]) => any>(Base: TBase) {
	abstract class ManagedStatefulComponentClass extends Base implements ManagedStatefulComponent {
		// State management properties
		public readonly stateSubject = new BehaviorSubject<ComponentStateInfo>({ 
			name: this.constructor.name, 
			state: ComponentState.UNINITIALIZED, 
			reason: 'Component created', 
			updatedOn: new Date() 
		});
		
		public readonly state$: Observable<ComponentStateInfo> = this.stateSubject.asObservable();
		
		// Promise tracking properties
		public initializationPromise: Promise<void> | undefined = undefined;
		public shutdownPromise: Promise<void> | undefined = undefined;
		
		// Property to ensure logger is available
		public abstract readonly logger: Logger;
		
		/** Gets the current state of the component
		 * @returns The current state information
		 */
		public getState(): ComponentStateInfo {
			return { ...this.stateSubject.value };
		}
		
		/** Initializes the component if it is not already initialized
		 * @returns Promise that resolves when the component is initialized
		 * @throws Error if initialization fails
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
					
					// Update state to indicate successful initialization
					this.stateSubject.next({
						name: this.constructor.name,
						state: ComponentState.OK,
						reason: 'Component initialized successfully',
						updatedOn: new Date()
					});
					
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
				
					reject(error);
				}
				finally {
					this.initializationPromise = undefined; // Reset initialization promise
				}
			});

			return this.initializationPromise;
		}
		
		/** Checks if the component is ready to serve requests
		 * @returns Promise that resolves to true if ready, false otherwise
		 * @throws Error if the component is not ready
		 * @remark May trigger initialization if the component supports lazy initialization
		 * * @remark A component is typically ready when in OK or DEGRADED state
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
					this.logger.log(`Shutting down...`, this.constructor.name);
					
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
		
		/** The actual initialization implementation specific to the component.
		 * Must be implemented by derived classes.
		 */
		public abstract executeInitialization(): Promise<void>;
		
		/** The actual shutdown implementation specific to the component.
		 * Must be implemented by derived classes.
		 */
		public abstract executeShutdown(): Promise<void>;
	}
	
	return ManagedStatefulComponentClass;
}