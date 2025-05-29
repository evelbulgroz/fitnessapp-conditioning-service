import { firstValueFrom, take } from 'rxjs';

import ComponentState from '../models/component-state.enum';
import DomainStateManager from './domain-state-manager.class';
import DomainStateManagerOptions from '../models/domain-state-manager-options.model';
import ManagedStatefulComponentMixin from '../mixins/managed-stateful-component.mixin';

// Create a concrete implementation for testing
class TestDomainManager extends DomainStateManager {
	public testValue: string = 'test';
	
	constructor(options?: DomainStateManagerOptions) {
		super(options);
	}
	
	public async onInitialize(): Promise<void> {
		this.testValue = 'initialized';
		return Promise.resolve();
	}

	public async onShutdown(): Promise<void> {
		this.testValue = 'shutdown';
		return Promise.resolve();
	}
}

// Mock the ManagedStatefulComponent interface for testing
class MockManagedStatefulComponent extends ManagedStatefulComponentMixin(class {}) {
}
describe('DomainStateManager', () => {
	let manager: TestDomainManager;

	beforeEach(() => {
		manager = new TestDomainManager();
	});

	it('can be instantiated as a subclass', () => {
		expect(manager).toBeInstanceOf(TestDomainManager);
		expect(manager).toBeInstanceOf(DomainStateManager);
	});

	it('inherits options property', () => {
		const optionsManager = new TestDomainManager({ virtualPath: 'test.path' });
		expect(optionsManager.msc_zh7y_options).toBeDefined();
		const options = optionsManager.msc_zh7y_options as DomainStateManagerOptions;
		expect(options?.virtualPath).toBe('test.path');
	});

	it('inherits componentState$ from ManagedStatefulComponentMixin', () => {
		expect(manager.componentState$).toBeDefined();
	});

	it('inherits initialize method from ManagedStatefulComponentMixin', async () => {
		expect(typeof manager.initialize).toBe('function');
		await manager.initialize();
		expect(manager.testValue).toBe('initialized');
		
		const state = await firstValueFrom(manager.componentState$.pipe(take(1)));
		expect(state.state).toBe(ComponentState.OK);
	});

	it('inherits shutdown method from ManagedStatefulComponentMixin', async () => {
		expect(typeof manager.shutdown).toBe('function');
		await manager.initialize(); // Initialize first
		await manager.shutdown();
		expect(manager.testValue).toBe('shutdown');
		
		const state = await firstValueFrom(manager.componentState$.pipe(take(1)));
		expect(state.state).toBe(ComponentState.SHUT_DOWN);
	});

	it('inherits component registration methods', () => {
		expect(typeof manager.registerSubcomponent).toBe('function');
		expect(typeof manager.unregisterSubcomponent).toBe('function');
	});

	it('can register a component', () => {
		const mockComponent = new MockManagedStatefulComponent();
		
		expect(() => manager.registerSubcomponent(mockComponent)).not.toThrow();
	});

	it('can unregister a component', () => {
		const mockComponent = new MockManagedStatefulComponent();
		
		manager.registerSubcomponent(mockComponent);
		expect(() => manager.unregisterSubcomponent(mockComponent)).not.toThrow();
	});
});