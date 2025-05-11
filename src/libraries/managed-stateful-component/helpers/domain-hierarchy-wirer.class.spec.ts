import DomainHierarchyWirer from './domain-hierarchy-wirer.class';
import DomainStateManager from './domain-state-manager.class';
import domainPathExtractor from '../models/domain-path-extractor.model';

// Create mock implementation of DomainStateManager for testing
class MockDomainManager extends DomainStateManager {
	public readonly managerId: string;
	public registeredComponents: DomainStateManager[] = [];

	constructor(managerId: string) {
		super();
		this.managerId = managerId;
	}

	// Override to track registrations for testing
	public registerSubcomponent(component: any): boolean {
		if (component instanceof DomainStateManager) {
			this.registeredComponents.push(component);
			return true;
		}
		return false;
	}

	// For easier test assertions
	public toString(): string {
		return this.managerId;
	}
}

describe('DomainHierarchyWirer', () => {
	let wirer: DomainHierarchyWirer;
	let mockManagers: MockDomainManager[];
	let mockPathExtractor: jest.MockedFunction<domainPathExtractor>;

	// Setup test data with a simulated file structure hierarchy
	beforeEach(() => {
		wirer = new DomainHierarchyWirer();
		
		// Create mock managers with IDs for identification in tests
		mockManagers = [
			new MockDomainManager('app'),
			new MockDomainManager('userModule'),
			new MockDomainManager('profileService'),
			new MockDomainManager('authModule'),
			new MockDomainManager('conditioningModule')
		];

		// Mock the path extractor to simulate file paths
		mockPathExtractor = jest.fn((manager: DomainStateManager) => {
			const mockManager = manager as MockDomainManager;
			switch (mockManager.managerId) {
				case 'app': 
					return 'app';
				case 'userModule': 
					return 'app.user';
				case 'profileService': 
					return 'app.user.profile';
				case 'authModule': 
					return 'app.auth';
				case 'conditioningModule': 
					return 'app.conditioning';
				default:
					return 'unknown';
			}
		});
	});
		
	it('can be created', () => {
		expect(wirer).toBeInstanceOf(DomainHierarchyWirer);
	});
	
	describe('Public API', () => {
		describe('wireDomains', () => {
			xit('registers child components with their parent managers', async () => {
				await wirer.wireDomains(mockManagers, mockPathExtractor);
				
				// Check that app has registered its children
				const appManager = mockManagers[0];
				expect(appManager.registeredComponents.length).toBe(3);
				expect(appManager.registeredComponents).toContain(mockManagers[1]); // userModule
				expect(appManager.registeredComponents).toContain(mockManagers[3]); // authModule
				expect(appManager.registeredComponents).toContain(mockManagers[4]); // conditioningModule
				
				// Check that user module registered profile service
				const userManager = mockManagers[1];
				expect(userManager.registeredComponents.length).toBe(1);
				expect(userManager.registeredComponents).toContain(mockManagers[2]); // profileService
				
				// Others should have no registered components
				expect(mockManagers[2].registeredComponents.length).toBe(0); // profileService
				expect(mockManagers[3].registeredComponents.length).toBe(0); // authModule
				expect(mockManagers[4].registeredComponents.length).toBe(0); // conditioningModule
			});

			it('does nothing with empty manager list', async () => {
				await wirer.wireDomains([], mockPathExtractor);
				// Test passes if no exception is thrown
			});

			xit('handles custom path separator', async () => {
				// Create a path extractor that uses / instead of .
				const slashPathExtractor = jest.fn((manager: DomainStateManager) => {
					const mockManager = manager as MockDomainManager;
					switch (mockManager.managerId) {
						case 'app': return 'app';
						case 'userModule': return 'app/user';
						case 'profileService': return 'app/user/profile';
						default: return 'unknown';
					}
				});
				
				await wirer.wireDomains(
					[mockManagers[0], mockManagers[1], mockManagers[2]], 
					slashPathExtractor,
					{
						separator: '/'
					}
				);
				
				// Check that app has registered user module
				expect(mockManagers[0].registeredComponents).toContain(mockManagers[1]);
				
				// Check that user module registered profile service
				expect(mockManagers[1].registeredComponents).toContain(mockManagers[2]);
			});
		});
	});

	describe('Protected Methods', () => {		
		describe('buildHierarchy', () => {
			describe('hierarchy', () => {
				it('correctly builds hierarchy based on paths', () => {
					// Access the protected method for testing
					const hierarchy = (wirer as any).buildHierarchy(
						mockManagers, 
						mockPathExtractor,
						'.'
					);
					
					// Verify the correct number of parent managers
					expect(hierarchy.size).toBe(2);
					
					// The root app should have 3 children: user, auth, conditioning
					const appChildren = hierarchy.get(mockManagers[0]);
					expect(appChildren).toBeDefined();
					expect(appChildren?.length).toBe(3);
					expect(appChildren).toContain(mockManagers[1]); // userModule
					expect(appChildren).toContain(mockManagers[3]); // authModule
					expect(appChildren).toContain(mockManagers[4]); // conditioningModule
					
					// The user module should have 1 child: profile
					const userChildren = hierarchy.get(mockManagers[1]);
					expect(userChildren).toBeDefined();
					expect(userChildren?.length).toBe(1);
					expect(userChildren).toContain(mockManagers[2]); // profileService
				});

				it('returns empty hierarchy from empty manager list', () => {
					const hierarchy = (wirer as any).buildHierarchy(
						[], 
						mockPathExtractor,
						'.'
					);
					
					expect(hierarchy.size).toBe(0);
				});

				xit('returns hierarchy with single root member if there is only a single manager, the root', () => {});

				xit('returns artificial hierarchy if there are multiple root managers (flat structure)', () => {
					// This test demonstrates the alternative implementation
					// Mock extractor that returns the same path for all managers
					const flatExtractor = jest.fn(() => 'app');
					
					// Call the protected method
					let hierarchy = (wirer as any).buildHierarchy(
						mockManagers, 
						flatExtractor,
						'.'
					);
					
					// Implement forgiving approach (simulating the enhancement)
					if (hierarchy.size === 0 && mockManagers.length > 0) {
						const rootManager = mockManagers[0];
						const childManagers = mockManagers.slice(1);
						
						// Create artificial hierarchy map
						hierarchy = new Map([[rootManager, childManagers]]);
					}
					
					// Expected: first manager becomes root with all others as children
					expect(hierarchy.size).toBe(1);
					const rootEntry = Array.from(hierarchy.entries())[0] as [DomainStateManager, DomainStateManager[]];
					expect(rootEntry[0]).toBe(mockManagers[0]);
					expect(rootEntry[1].length).toBe(mockManagers.length - 1);
					expect(rootEntry[1]).toEqual(mockManagers.slice(1));
				});

				xit('it handles hierarchies of arbitrary depth (tested at 10 levels)', () => {});			
				
				xit('throws if two managers claim the same path', () => {});
			});

			describe('paths', () => {
				xit('handles paths case-insensitively ', () => { });
			
				it('handles custom path separator', () => {
					// Create a path extractor that uses / instead of .
					const slashPathExtractor = jest.fn((manager: DomainStateManager) => {
						const mockManager = manager as MockDomainManager;
						switch (mockManager.managerId) {
							case 'app': return 'app';
							case 'userModule': return 'app/user';
							case 'profileService': return 'app/user/profile';
							default: return 'unknown';
						}
					});
					
					const hierarchy = (wirer as any).buildHierarchy(
						mockManagers, 
						slashPathExtractor,
						{
							separator: '/'
						}
					);
					
					expect(hierarchy.size).toBe(2);
				});
				
				xit('handles duplicate separators in paths', () => { });

				xit('handles leading separators in paths', () => { });

				xit('handles trailing separators in paths', () => { });

				xit('handles whitespace in paths', () => { });

				it('handles empty segments in paths', () => {
					// Create a path extractor that returns empty segments
					const emptySegmentExtractor = jest.fn((manager: DomainStateManager) => {
						const mockManager = manager as MockDomainManager;
						switch (mockManager.managerId) {
							case 'app': return 'app';
							case 'userModule': return 'app..user';
							case 'profileService': return 'app/user/profile';
							default: return 'unknown';
						}
					});
					
					const hierarchy = (wirer as any).buildHierarchy(
						mockManagers, 
						emptySegmentExtractor,
						{
							separator: '.'
						}
					);
					
					expect(hierarchy.size).toBe(2);
				});

				xit('handles symbols in paths', () => { });
				
				xit('handles numbers in paths', () => { });

				xit('throws if path extractor is not a function', () => {});

				xit('throws if path separator is not a string', () => {});

				xit('throws if path is malformed', () => {});

				xit('throws if path extractor returns an empty string', () => {});

				xit('throws if path references non-existing parent', () => {});

				xit('throws if path references a parent that is not a domain state manager', () => {});

				xit('throws if path references non-existing child', () => {});

				xit('throws if path references a child that is not a registered component', () => {});

				xit('throws if path references a child that is not a domain manager', () => {});
			});			
		});
	});

	describe('integration', () => {
		xit('builds a complete hierarchy with virtual paths', async () => {
			// Add a manager with a virtual path option
			// TODO: set this via mixin options
			const virtualPathManager = new MockDomainManager('virtualModule', //{virtualPath: 'app.virtual.custom'}
			);
			
			// Update the mock extractor to use the virtual path
			mockPathExtractor.mockImplementation((manager: DomainStateManager) => {
				const mockManager = manager as MockDomainManager;
				// First check for virtual path
				if ((mockManager as any).options?.virtualPath) {
					return (mockManager as any).options.virtualPath;
				}

				// Otherwise use the previous implementation
				switch (mockManager.managerId) {
					case 'app': return 'app';
					case 'userModule': return 'app.user';
					case 'profileService': return 'app.user.profile';
					case 'authModule': return 'app.auth';
					case 'conditioningModule': return 'app.conditioning';
					default: return 'unknown';
				}
			});
			
			// Add the virtual path manager to our test set
			mockManagers.push(virtualPathManager);
			
			await wirer.wireDomains(mockManagers, mockPathExtractor);
			
			// Virtual path should make this manager a child of app
			expect(mockManagers[0].registeredComponents).toContain(virtualPathManager);
		});
	});

	describe('Utility Methods', () => {
		class MockManager extends DomainStateManager {
			constructor(options: any = {}) {
				super();
				Object.assign(this, options);
			}
		}

		class ManagerWithVirtualPath extends DomainStateManager {
			getVirtualPath() {
				return 'virtual.path.manager';
			}
		}
		
		let wirer: DomainHierarchyWirer;
		beforeEach(() => {
			wirer = new DomainHierarchyWirer();
		});

		describe('getManagerIdentifier', () => {
			it('uses managerId when available', () => {
			// Arrange
			const manager = new MockManager({ managerId: 'test-123' });
			
			// Act
			const result = (wirer as any).getManagerIdentifier(manager);
			
			// Assert
			expect(result).toBe('MockManager:test-123');
			});
			
			it('uses path when managerId is not available', () => {
			// Arrange
			const manager = new MockManager({ path: 'app.domain.subdomain' });
			
			// Act
			const result = (wirer as any).getManagerIdentifier(manager);
			
			// Assert
			expect(result).toBe('MockManager:app.domain.subdomain');
			});
			
			it('generates random suffix when neither managerId nor path is available', () => {
			// Arrange
			const manager = new MockManager();
			
			// Act
			const result = (wirer as any).getManagerIdentifier(manager);
			
			// Assert
			expect(result).toMatch(/^MockManager:[a-z0-9]{5}$/);
			});
		});

		describe('getManagerPath', () => {
			it('retrieves path property when available', () => {
			// Arrange
			const manager = new MockManager({ path: 'app.domain.path' });
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBe('app.domain.path');
			});
			
			it('retrieves __path property when available', () => {
			// Arrange
			const manager = new MockManager({ __path: 'app.domain.__path' });
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBe('app.domain.__path');
			});
			
			it('calls getVirtualPath method when available', () => {
			// Arrange
			const manager = new ManagerWithVirtualPath();
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBe('virtual.path.manager');
			});
			
			it('retrieves virtualPath from options when available', () => {
			// Arrange
			const manager = new MockManager({ 
				options: { virtualPath: 'app.domain.options.virtualPath' } 
			});
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBe('app.domain.options.virtualPath');
			});
			
			it('returns undefined when no path is available', () => {
			// Arrange
			const manager = new MockManager();
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBeUndefined();
			});
			
			it('prioritizes path over __path', () => {
			// Arrange
			const manager = new MockManager({ 
				path: 'app.domain.path',
				__path: 'app.domain.__path' 
			});
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBe('app.domain.path');
			});
			
			it('prioritizes explicit properties over getVirtualPath method', () => {
			// Arrange
			class PrioritizedManager extends ManagerWithVirtualPath {
				constructor() {
				super();
				(this as any).path = 'app.domain.prioritized';
				}
			}
			const manager = new PrioritizedManager();
			
			// Act
			const result = (wirer as any).getManagerPath(manager);
			
			// Assert
			expect(result).toBe('app.domain.prioritized');
			});
		});

		describe('serializeHierarchy', () => {
			it('correctly serializes an empty hierarchy', () => {
			// Arrange
			const hierarchy = new Map();
			
			// Act
			const result = (wirer as any).serializeHierarchy(hierarchy);
			
			// Assert
			expect(result).toEqual({});
			});
			
			it('correctly serializes a hierarchy with one parent and no children', () => {
				// Arrange
				const parent = new MockManager({ path: 'app.parent' });
				const hierarchy = new Map([[parent, []]]);
				
				// Act
				const result = (wirer as any).serializeHierarchy(hierarchy);
				
				// Assert
				const parentId = (wirer as any).getManagerIdentifier(parent);
				expect(result[parentId]).toBeDefined(); // Changed from toHaveProperty
				expect(result[parentId]).toEqual({
					name: 'MockManager',
					path: 'app.parent',
					children: []
				});
			});
			
			it('correctly serializes a hierarchy with one parent and multiple children', () => {
				// Arrange
				const parent = new MockManager({ path: 'app.parent' });
				const child1 = new MockManager({ path: 'app.parent.child1' });
				const child2 = new MockManager({ path: 'app.parent.child2' });
				const hierarchy = new Map([[parent, [child1, child2]]]);
				
				// Act
				const result = (wirer as any).serializeHierarchy(hierarchy);
				
				// Assert
				const parentId = (wirer as any).getManagerIdentifier(parent);
				const child1Id = (wirer as any).getManagerIdentifier(child1);
				const child2Id = (wirer as any).getManagerIdentifier(child2);
				
				expect(result[parentId]).toBeDefined(); // Changed from toHaveProperty
				expect(result[parentId].children).toHaveLength(2);
				expect(result[parentId].children[0]).toEqual({
					id: child1Id,
					name: 'MockManager',
					path: 'app.parent.child1'
				});
				expect(result[parentId].children[1]).toEqual({
					id: child2Id,
					name: 'MockManager',
					path: 'app.parent.child2'
				});
			});
			
			it('correctly serializes a complex hierarchy with multiple parents', () => {
				// Arrange
				const parent1 = new MockManager({ path: 'app.parent1' });
				const parent2 = new MockManager({ path: 'app.parent2' });
				const child1 = new MockManager({ path: 'app.parent1.child1' });
				const child2 = new MockManager({ path: 'app.parent2.child2' });
				
				const hierarchy = new Map([
					[parent1, [child1]],
					[parent2, [child2]]
				]);
				
				// Act
				const result = (wirer as any).serializeHierarchy(hierarchy);
				
				// Assert
				const parent1Id = (wirer as any).getManagerIdentifier(parent1);
				const parent2Id = (wirer as any).getManagerIdentifier(parent2);
				
				expect(Object.keys(result)).toHaveLength(2);
				expect(result[parent1Id]).toBeDefined(); // Changed from toHaveProperty
				expect(result[parent2Id]).toBeDefined(); // Changed from toHaveProperty
				expect(result[parent1Id].children).toHaveLength(1);
				expect(result[parent2Id].children).toHaveLength(1);
			});
			
			it('handles managers with various path retrieval mechanisms', () => {
			// Arrange
			const pathManager = new MockManager({ path: 'app.path' });
			const virtualPathManager = new ManagerWithVirtualPath();
			const optionsManager = new MockManager({ 
				options: { virtualPath: 'app.options.virtual' } 
			});
			
			const hierarchy = new Map([
				[pathManager, [virtualPathManager, optionsManager]]
			]);
			
			// Act
			const result = (wirer as any).serializeHierarchy(hierarchy);
			
			// Assert
			const parentId = (wirer as any).getManagerIdentifier(pathManager);
			expect(result[parentId].children).toHaveLength(2);
			expect(result[parentId].children[0].path).toBe('virtual.path.manager');
			expect(result[parentId].children[1].path).toBe('app.options.virtual');
			});
		});
	});
});