import { filter, firstValueFrom, take } from 'rxjs';

import ManagedStatefulComponentMixin from './managed-stateful-component.mixin';
import CompositeStatefulComponentMixin from './composite-stateful-component.mixin';
import ComponentState from '../models/component-state';
import ComponentStateInfo from '../models/component-state-info';
import ManagedStatefulComponent from '../models/managed-stateful-component';

// Mock component that can be used as a subcomponent
class MockComponent extends ManagedStatefulComponentMixin(class {}) {
	public initCount = 0;
	public shutdownCount = 0;
	public shouldFailInit = false;
	public shouldFailShutdown = false;
	public initDelay = 0;
	public shutdownDelay = 0;
	
	public async executeInitialization(): Promise<void> {
		this.initCount++;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.shouldFailInit) {
					reject(new Error('Mock component initialization failed'));
				} else {
					resolve();
				}
			}, this.initDelay);
		});
	}
	
	public async executeShutdown(): Promise<void> {
		this.shutdownCount++;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.shouldFailShutdown) {
					reject(new Error('Mock component shutdown failed'));
				} else {
					resolve();
				}
			}, this.shutdownDelay);
		});
	}
}

// Composite component under test
class TestCompositeComponent extends CompositeStatefulComponentMixin(
	ManagedStatefulComponentMixin(class {})
) {
	public initCount = 0;
	public shutdownCount = 0;
	public shouldFailInit = false;
	public shouldFailShutdown = false;
	
	public getComponentCount(): number {
		return this.subcomponents.length;
	}
	
	// Expose internal methods for testing
	public testRegisterComponent<T extends ManagedStatefulComponent>(component: T): T {
		return this.registerSubcomponent(component);
	}
	
	public testUnregisterComponent(component: ManagedStatefulComponent): boolean {
		return this.unregisterSubcomponent(component);
	}
	
	public testGetSubcomponents(): ReadonlyArray<ManagedStatefulComponent> {
		return this.getSubcomponents();
	}
	
	public async executeInitialization(): Promise<void> {
		this.initCount++;
		if (this.shouldFailInit) {
			throw new Error('Test component initialization failed');
		}
		return Promise.resolve();
	}
	
	public async executeShutdown(): Promise<void> {
		this.shutdownCount++;
		if (this.shouldFailShutdown) {
			throw new Error('Test component shutdown failed');
		}
		return Promise.resolve();
	}
}

describe('CompositeStatefulComponentMixin', () => {
	let composite: TestCompositeComponent;
	let subComponent1: MockComponent;
	let subComponent2: MockComponent;
	
	beforeEach(() => {
		composite = new TestCompositeComponent();
		subComponent1 = new MockComponent();
		subComponent2 = new MockComponent();
	});
	
	describe('Component registration', () => {
		it('should register a subcomponent', () => {
			// Arrange
			const initialCount = composite.getComponentCount();
			
			// Act
			composite.testRegisterComponent(subComponent1);
			
			// Assert
			expect(composite.getComponentCount()).toBe(initialCount + 1);
		});
		
		it('should throw an error when registering null/undefined', () => {
			// Act & Assert
			expect(() => composite.testRegisterComponent(null as any)).toThrow();
			expect(() => composite.testRegisterComponent(undefined as any)).toThrow();
		});
		
		it('should unregister a subcomponent', () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			const countBeforeUnregister = composite.getComponentCount();
			
			// Act
			const result = composite.testUnregisterComponent(subComponent1);
			
			// Assert
			expect(result).toBe(true);
			expect(composite.getComponentCount()).toBe(countBeforeUnregister - 1);
		});
		
		it('should return false when unregistering a component that is not registered', () => {
			// Arrange - no components registered
			
			// Act
			const result = composite.testUnregisterComponent(subComponent1);
			
			// Assert
			expect(result).toBe(false);
		});
		
		it('should get all registered subcomponents', () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			
			// Act
			const components = composite.testGetSubcomponents();
			
			// Assert
			expect(components.length).toBe(2);
			expect(components).toContain(subComponent1);
			expect(components).toContain(subComponent2);
			expect(Array.isArray(components)).toBe(true);
		});
		
		it('should subscribe to subcomponent state changes', async () => {
			// Arrange
			const stateChanges: ComponentStateInfo[] = [];
			composite.state$.subscribe(state => {
				stateChanges.push({ ...state });
			});
			
			// Act
			composite.testRegisterComponent(subComponent1);
			await subComponent1.initialize();
			
			// Allow time for state to propagate
			await new Promise(resolve => setTimeout(resolve, 0));
			
			// Assert
			expect(stateChanges.length).toBeGreaterThan(0);
			const lastState = stateChanges[stateChanges.length - 1];
			expect(lastState.components).toBeDefined();
			expect(lastState.components?.length).toBe(1);
		});
		
		it('should clean up subscriptions when unregistering a subcomponent', () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			const subscriptionCount = composite.componentSubscriptions.size;
			
			// Act
			composite.testUnregisterComponent(subComponent1);
			
			// Assert
			expect(subscriptionCount).toBe(1);
			expect(composite.componentSubscriptions.size).toBe(0);
		});
	});
	
	describe('getState', () => {
		it('should return basic state when no subcomponents are registered', () => {
			// Arrange - default setup with no subcomponents
			
			// Act
			const state = composite.getState();
			
			// Assert
			expect(state.components).toBeUndefined();
		});
		
		it('should include subcomponent states when subcomponents are registered', () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			
			// Act
			const state = composite.getState();
			
			// Assert
			expect(state.components).toBeDefined();
			expect(state.components?.length).toBe(2);
		});
		
		it('should reflect the worst state among all components', async () => {
			// Arrange
			await composite.initialize(); // Initialize the composite first (OK state)
			subComponent1.shouldFailInit = true;
			composite.testRegisterComponent(subComponent1);
			
			// Act
			try {
				await subComponent1.initialize();
			} catch (error) {
				// Expected error
			}
			
			// Assert
			const state = composite.getState();
			expect(state.state).toBe(ComponentState.FAILED);
		});
	});
	
	describe('initialize', () => {
		it('should initialize the composite component first', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			
			// Act
			await composite.initialize();
			
			// Assert
			expect(composite.initCount).toBe(1);
			expect(subComponent1.initCount).toBe(1);
		});
		
		it('should initialize all subcomponents in parallel', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			subComponent1.initDelay = 50;
			subComponent2.initDelay = 50;
			
			// Act
			const startTime = Date.now();
			await composite.initialize();
			const duration = Date.now() - startTime;
			
			// Assert
			expect(subComponent1.initCount).toBe(1);
			expect(subComponent2.initCount).toBe(1);
			expect(duration).toBeLessThan(95); // Allow some margin
		});
		
		it('should fail if any subcomponent initialization fails', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			subComponent2.shouldFailInit = true;
			
			// Act & Assert
			await expect(composite.initialize()).rejects.toThrow();
			
			// Additional Assert
			const state = composite.getState();
			expect(state.state).toBe(ComponentState.FAILED);
		});
		
		it('should update aggregated state after initialization', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			
			// Act
			await composite.initialize();
			
			// Assert
			const state = composite.getState();
			expect(state.components).toBeDefined();
			expect(state.components?.[0].state).toBe(ComponentState.OK);
		});
	});
	
	describe('isReady', () => {
		it('should return true if composite and all subcomponents are ready', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			
			// Create a promise that will resolve when both components reach OK state
			const compositeStatePromise = firstValueFrom(
				composite.state$.pipe(
				filter(state => state.state === ComponentState.OK),
				take(1)
				)
			);
			
			const subComponentStatePromise = firstValueFrom(
				subComponent1.state$.pipe(
				filter(state => state.state === ComponentState.OK),
				take(1)
				)
			);
			
			// Initialize both components
			await composite.initialize();
			await subComponent1.initialize();
			
			// Wait for both components to reach OK state
			await Promise.all([compositeStatePromise, subComponentStatePromise]);
			
			// Verify both components are now in OK state
			expect(composite.getState().state).toBe(ComponentState.OK);
			expect(subComponent1.getState().state).toBe(ComponentState.OK);
			
			// Explicitly mock isReady for both components to ensure consistent behavior
			jest.spyOn(composite, 'isComponentReady').mockImplementation(async () => true);
			jest.spyOn(subComponent1, 'isReady').mockImplementation(async () => true);
			
			// Act
			const isReady = await composite.isReady();
			
			// Assert
			expect(isReady).toBe(true);
			
			// Cleanup
			jest.restoreAllMocks();
		});
		
		it('should return false if composite is not ready', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			await subComponent1.initialize();
			// Composite not initialized
			
			// Act
			const isReady = await composite.isReady();
			
			// Assert
			expect(isReady).toBe(false);
		});
		
		it('should return false if any subcomponent is not ready', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			await composite.initialize();
			await subComponent1.initialize();
			// subComponent2 not initialized
			
			// Act
			const isReady = await composite.isReady();
			
			// Assert
			expect(isReady).toBe(false);
		});
		
		it('should return false if checking subcomponent readiness throws an error', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			await composite.initialize();
			
			// Mock isReady to throw
			const originalIsReady = subComponent1.isReady;
			subComponent1.isReady = jest.fn().mockImplementation(() => {
				throw new Error('isReady failed');
			});
			
			// Act
			const isReady = await composite.isReady();
			
			// Assert
			expect(isReady).toBe(false);
			
			// Cleanup
			subComponent1.isReady = originalIsReady;
		});
	});
	
	describe('shutdown', () => {
		it('should shut down all subcomponents before shutting down the composite', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			await composite.initialize();
			
			const shutdownOrder: string[] = [];
			
			// Spy on the subcomponent's shutdown method
			const originalSubShutdown = subComponent1.shutdown;
			subComponent1.shutdown = async function() {
				shutdownOrder.push('subcomponent');
				return originalSubShutdown.call(this);
			};
			
			// Spy on the composite component's shutdown method
			// Fix: Use the correct prototype - the parent class method that's being called
			const originalCompositeExecuteShutdown = composite.executeShutdown;
			composite.executeShutdown = async function() {
				shutdownOrder.push('composite');
				return originalCompositeExecuteShutdown.call(this);
			};
			
			// Act
			await composite.shutdown();
			
			// Assert
			expect(shutdownOrder[0]).toBe('subcomponent');
			expect(shutdownOrder[1]).toBe('composite');
			
			// Cleanup - restore original methods
			subComponent1.shutdown = originalSubShutdown;
			composite.executeShutdown = originalCompositeExecuteShutdown;
		});
		
		it('should clean up all subscriptions during shutdown', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			await composite.initialize();
			const subscriptionCountBefore = composite.componentSubscriptions.size;
			
			// Act
			await composite.shutdown();
			
			// Assert
			expect(subscriptionCountBefore).toBe(2);
			expect(composite.componentSubscriptions.size).toBe(0);
		});
		
		it('should collect errors from failed subcomponent shutdowns', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			await composite.initialize();
			
			subComponent1.shouldFailShutdown = true;
			
			// Act & Assert
			await expect(composite.shutdown()).rejects.toThrow();
			
			try {
				await composite.shutdown();
			} catch (error) {
				// Additional Assertions
				expect(error).toBeInstanceOf(AggregateError);
				const aggregateError = error as AggregateError;
				expect(aggregateError.errors).toHaveLength(1);
			}
		});
		
		it('should still shut down the composite even if all subcomponents fail', async () => {
			// Arrange
			composite.testRegisterComponent(subComponent1);
			composite.testRegisterComponent(subComponent2);
			await composite.initialize();
			
			subComponent1.shouldFailShutdown = true;
			subComponent2.shouldFailShutdown = true;
			
			// Act
			try {
				await composite.shutdown();
			} catch (error) {
				// Expected error
			}
			
			// Assert
			expect(composite.shutdownCount).toBe(1);
		});
	});
	
	describe('State aggregation', () => {
		it('should calculate the worst state correctly', async () => {
			// Arrange
			const states: ComponentStateInfo[] = [
				{ name: 'Component1', state: ComponentState.OK, reason: 'OK', updatedOn: new Date() },
				{ name: 'Component2', state: ComponentState.DEGRADED, reason: 'Degraded', updatedOn: new Date() }
			];
			
			// Act
			const worstState = (composite as any).calculateWorstState(states);
			
			// Assert
			expect(worstState.state).toBe(ComponentState.DEGRADED);
			
			// Arrange - add a worse state
			states.push({ name: 'Component3', state: ComponentState.FAILED, reason: 'Failed', updatedOn: new Date() });
			
			// Act
			const newWorstState = (composite as any).calculateWorstState(states);
			
			// Assert
			expect(newWorstState.state).toBe(ComponentState.FAILED);
		});
		
		it('should create human-readable reason strings', async () => {
			// Arrange
			const states: ComponentStateInfo[] = [
				{ name: 'Component1', state: ComponentState.OK, reason: 'Running well', updatedOn: new Date() },
				{ name: 'Component2', state: ComponentState.DEGRADED, reason: 'Slow response', updatedOn: new Date() },
				{ name: 'Component3', state: ComponentState.OK, reason: 'All good', updatedOn: new Date() },
			];
			
			const worstState = states[1]; // The DEGRADED one
			
			// Act
			const reason = (composite as any).createAggregatedReason(states, worstState);
			
			// Assert
			expect(reason).toContain('OK: 2/3');
			expect(reason).toContain('DEGRADED: 1/3');
			expect(reason).toContain('Component2');
			expect(reason).toContain('Slow response');
		});
		
		it('should update the aggregated state when subcomponent states change', async () => {
			// Arrange
			const stateChanges: ComponentStateInfo[] = [];
			
			composite.state$.pipe(take(3)).subscribe(state => {
				stateChanges.push({ ...state });
			});
			
			// Act - Part 1
			await composite.initialize(); // First state change
			
			// Act - Part 2
			composite.testRegisterComponent(subComponent1);
			
			// Act - Part 3
			await subComponent1.initialize();
			
			// Assert
			expect(stateChanges.length).toBe(3);
			
			// Assert - final composite state
			const finalState = composite.getState();
			expect(finalState.components).toBeDefined();
			expect(finalState.components?.length).toBe(1);
			expect(finalState.components?.[0].state).toBe(ComponentState.OK);
		});
	});
});