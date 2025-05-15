import { Subject } from 'rxjs';

import { StreamLogger } from '../../stream-loggable';

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
	// Setup test data with a simulated file structure hierarchy
	let wirer: DomainHierarchyWirer;
	let mockManagers: MockDomainManager[];
	let mockPathExtractor: jest.MockedFunction<domainPathExtractor>;
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

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(wirer.log$).toBeDefined();
				expect(wirer.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(wirer.logger).toBeDefined();
				expect(wirer.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(wirer.logToStream).toBeDefined();
				expect(typeof wirer.logToStream).toBe('function');
			});
		});
	});

	describe('Protected Methods', () => {		
		describe('buildHierarchy', () => {
			xdescribe('hierarchy', () => {
				it('correctly builds hierarchy based on paths', () => {
					// Access the protected method for testing
					const hierarchy = (wirer as any).buildHierarchy(
						mockManagers, 
						mockPathExtractor,
						'.'
					);
					
					// Verify the correct number of parent managers
					 // Both parent and child managers should be included
					expect(hierarchy.size).toBe(5);
					
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
					// Arrange
					// Act
					const hierarchy = (wirer as any).buildHierarchy(
						[], 
						mockPathExtractor,
						'.'
					);
					
					// Assert
					expect(hierarchy.size).toBe(0);
				});

				it('returns hierarchy with single root member if there is only a single manager, the root', () => {
					// Arrange
					const singleManager = new MockDomainManager('singleRoot');
					const mockPathExtractor = jest.fn((manager: DomainStateManager) => {
						const mockManager = manager as MockDomainManager;
						return mockManager.managerId;
					});

					// Act
					const hierarchy = (wirer as any).buildHierarchy(
						[singleManager], 
						mockPathExtractor,
						'.'
					);
					
					// Assert
					expect(hierarchy.size).toBe(1);
					const rootEntry = Array.from(hierarchy.entries())[0] as [DomainStateManager, DomainStateManager[]];
					expect(rootEntry[0]).toBe(singleManager);
					expect(rootEntry[1].length).toBe(0);
				});				

				it('it handles hierarchies of arbitrary depth (tested at 10 levels)', () => {
					// Arrange
					 // set up hierarchy with 10 levels, where each manager is a child of the previous one
					 // by assigning successively deeper paths, e.g. 1, 1.1, 1.1.1, etc.
					const deepManagers: DomainStateManager[] = [];
					let parentId = '';
					for (let i = 0; i < 10; i++) {
						const managerId = parentId ? `${parentId}.${i}` : `${i}`;
						parentId = managerId;
						deepManagers.push(new MockDomainManager(managerId));
					}

					// Mock the path extractor to simulate deep paths
					const deepPathExtractor = (manager: DomainStateManager) => {
						const mockManager = manager as MockDomainManager;
						return mockManager.managerId;
					};

					// Act
					const hierarchy = (wirer as any).buildHierarchy(
						deepManagers, 
						deepPathExtractor,
						'.'
					);
					
					// Assert
					expect(hierarchy.size).toBe(10); // 9 parents, 1 root
					const rootEntry = Array.from(hierarchy.entries())[0] as [DomainStateManager, DomainStateManager[]];
					expect(rootEntry[0]).toBe(deepManagers[0]); // root manager					
					expect(rootEntry[1].length).toBe(1);// root manager should have 1 child

					let currentParent: DomainStateManager | null = rootEntry[0];
					while (currentParent) {
						const children: DomainStateManager[] = hierarchy.get(currentParent);
						if (children && children.length > 0) {
							expect(children[0]).toBe(deepManagers[deepManagers.indexOf(currentParent) + 1]);
							currentParent = children[0];
						} else {
							currentParent = null;
						}
					}
				});
				
				it('throws if two managers claim the same path', () => {
					// Arrange
					const conflictingManagers = [
						new MockDomainManager('conflict1'),
						new MockDomainManager('conflict2')
					];
					const conflictingPathExtractor = jest.fn((manager: DomainStateManager) => {
						return 'app.user'; // Both managers return the same path
					});

					// Act & Assert
					expect(() => {
						(wirer as any).buildHierarchy(
							conflictingManagers, 
							conflictingPathExtractor,
							'.'
						);
					}).toThrow('Two managers claim the same path: app.user');
				});
			});

			describe('paths', () => {
				it('handles paths case-insensitively', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'App.User' : 'app.user.profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '.' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				it('handles custom path separator', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'app/user' : 'app/user/profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '/' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				it('handles duplicate separators in paths', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'app..user' : 'app..user.profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '.' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				it('handles leading separators in paths', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? '.app.user' : '.app.user.profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '.' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				xit('handles trailing separators in paths', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'app.user.' : 'app.user.profile.';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '.' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				it('handles whitespace in paths', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'app . user' : 'app . user . profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '.' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				it('handles symbols in paths', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'app@user' : 'app@user@profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '@' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child);
					expect(hierarchy.get(child)).toEqual([]);
				});

				it('handles numbers in paths', () => {
					const managers = [
						new MockDomainManager('A'),
						new MockDomainManager('B')
					];
					const extractor = jest.fn((manager: DomainStateManager) => {
						const id = (manager as MockDomainManager).managerId;
						return id === 'A' ? 'app.1' : 'app.1.profile';
					});
					const hierarchy = (wirer as any).buildHierarchy(managers, extractor, { separator: '.' });
					expect(hierarchy.size).toBe(2);
					const parent = managers[0];
					const child = managers[1];
					expect(hierarchy.get(parent)).toContain(child); // bug: receives empty array
					expect(hierarchy.get(child)).toEqual([]);
				});
			});
		});

		describe('constructHierarchyMap', () => {
			it('includes all managers as keys, even if they have no children', () => {
				const m1 = new MockDomainManager('m1');
				const m2 = new MockDomainManager('m2');
				const m3 = new MockDomainManager('m3');
				const pathToManager = new Map<string, DomainStateManager>([
					['a', m1],
					['a.b', m2],
					['a.c', m3]
				]);
				const pathToChildren = new Map<string, string[]>([
					['a', ['a.b', 'a.c']],
					['a.b', []],
					['a.c', []]
				]);
				const result = (wirer as any).constructHierarchyMap(pathToManager, pathToChildren);
				expect(result.size).toBe(3);
				expect(result.get(m1)).toEqual([m2, m3]);
				expect(result.get(m2)).toEqual([]);
				expect(result.get(m3)).toEqual([]);
			});

			it('returns empty map if pathToManager is empty', () => {
				const result = (wirer as any).constructHierarchyMap(new Map(), new Map());
				expect(result.size).toBe(0);
			});

			it('returns empty children array if pathToChildren is missing for a path', () => {
				const m1 = new MockDomainManager('m1');
				const pathToManager = new Map<string, DomainStateManager>([['a', m1]]);
				const pathToChildren = new Map<string, string[]>(); // no entry for 'a'
				const result = (wirer as any).constructHierarchyMap(pathToManager, pathToChildren);
				expect(result.size).toBe(1);
				expect(result.get(m1)).toEqual([]);
			});

			it('filters out child paths that do not exist in pathToManager', () => {
				const m1 = new MockDomainManager('m1');
				const m2 = new MockDomainManager('m2');
				const pathToManager = new Map<string, DomainStateManager>([
					['a', m1],
					['a.b', m2]
				]);
				const pathToChildren = new Map<string, string[]>([
					['a', ['a.b', 'a.c']] // a.c does not exist
				]);
				const result = (wirer as any).constructHierarchyMap(pathToManager, pathToChildren);
				expect(result.size).toBe(2);
				expect(result.get(m1)).toEqual([m2]);
				expect(result.get(m2)).toEqual([]);
			});
		});

		describe('filterDomainManagers', () => {
			it('returns only DomainStateManager instances', () => {
				// Arrange
				const validManager1 = new MockDomainManager('valid1');
				const validManager2 = new MockDomainManager('valid2');
				const invalidObject1 = {};
				const invalidObject2 = { managerId: 'fake' };
				const invalidObject3 = null;
				
				const mixedArray = [
					validManager1, 
					invalidObject1, 
					validManager2, 
					invalidObject2, 
					invalidObject3
				];
				
				// Act
				const result = (wirer as any).filterDomainManagers(mixedArray);
				
				// Assert
				expect(result.length).toBe(2);
				expect(result).toContain(validManager1);
				expect(result).toContain(validManager2);
			});
			
			it('unwraps DomainStateManager instances from provider objects', () => {
				// Arrange
				const manager1 = new MockDomainManager('manager1');
				const manager2 = new MockDomainManager('manager2');
				
				const provider1 = { instance: manager1 };
				const provider2 = { instance: manager2, someOtherProp: 'value' };
				
				// Act
				const result = (wirer as any).filterDomainManagers([provider1, provider2]);
				
				// Assert
				expect(result.length).toBe(2);
				expect(result).toContain(manager1);
				expect(result).toContain(manager2);
			});
			
			it('handles a mix of direct instances and provider objects', () => {
				// Arrange
				const directManager = new MockDomainManager('direct');
				const wrappedManager = new MockDomainManager('wrapped');
				const provider = { instance: wrappedManager };
				
				// Act
				const result = (wirer as any).filterDomainManagers([directManager, provider]);
				
				// Assert
				expect(result.length).toBe(2);
				expect(result).toContain(directManager);
				expect(result).toContain(wrappedManager);
			});
			
			it('returns empty array when given empty array', () => {
				// Act
				const result = (wirer as any).filterDomainManagers([]);
				
				// Assert
				expect(result).toEqual([]);
			});
			
			it('filters out provider objects with non-DomainStateManager instances', () => {
				// Arrange
				const validManager = new MockDomainManager('valid');
				const invalidProvider1 = { instance: {} };
				const invalidProvider2 = { instance: 'string' };
				const invalidProvider3 = { instance: null };
				const validProvider = { instance: validManager };
				
				// Act
				const result = (wirer as any).filterDomainManagers([
					invalidProvider1,
					invalidProvider2,
					invalidProvider3,
					validProvider
				]);
				
				// Assert
				expect(result.length).toBe(1);
				expect(result).toContain(validManager);
			});
			
			it('returns empty array when no valid managers exist', () => {
				// Arrange
				const invalidObjects = [
					{},
					{ instance: {} },
					{ managerId: 'fake' },
					'string',
					123,
					null,
					undefined
				];
				
				// Act
				const result = (wirer as any).filterDomainManagers(invalidObjects);
				
				// Assert
				expect(result).toEqual([]);
			});
		});

		describe('extractPathMappings', () => {
			it('correctly maps paths to managers', () => {
				// Act
				const { pathToManager } = (wirer as any).extractPathMappings(
					mockManagers, 
					mockPathExtractor,
					{ separator: '.' }
				);
				
				// Assert
				expect(pathToManager.size).toBe(5);
				expect(pathToManager.get('app')).toBe(mockManagers[0]);
				expect(pathToManager.get('app.user')).toBe(mockManagers[1]);
				expect(pathToManager.get('app.user.profile')).toBe(mockManagers[2]);
				expect(pathToManager.get('app.auth')).toBe(mockManagers[3]);
				expect(pathToManager.get('app.conditioning')).toBe(mockManagers[4]);
			});
			
			it('correctly sets up parent-child relationships', () => {
				// Act
				const { pathToChildren } = (wirer as any).extractPathMappings(
					mockManagers, 
					mockPathExtractor,
					{ separator: '.' }
				);
				
				// Assert
				// app has three children: user, auth, conditioning
				expect(pathToChildren.get('app')?.length).toBe(3);
				expect(pathToChildren.get('app')).toContain('app.user');
				expect(pathToChildren.get('app')).toContain('app.auth');
				expect(pathToChildren.get('app')).toContain('app.conditioning');
				
				// app.user has one child: profile
				expect(pathToChildren.get('app.user')?.length).toBe(1);
				expect(pathToChildren.get('app.user')).toContain('app.user.profile');
				
				// Other paths don't have children
				expect(pathToChildren.get('app.user.profile')?.length).toBe(0);
				expect(pathToChildren.get('app.auth')?.length).toBe(0);
				expect(pathToChildren.get('app.conditioning')?.length).toBe(0);
			});
			
			it('returns empty maps for empty manager list', () => {
				// Act
				const { pathToManager, pathToChildren } = (wirer as any).extractPathMappings(
					[], 
					mockPathExtractor,
					{ separator: '.' }
				);
				
				// Assert
				expect(pathToManager.size).toBe(0);
				expect(pathToChildren.size).toBe(0);
			});
			
			it('normalizes paths to lowercase for case-insensitivity', () => {
				// Arrange
				const casePathExtractor = jest.fn((manager: DomainStateManager) => {
					const mockManager = manager as MockDomainManager;
					switch (mockManager.managerId) {
						case 'app': return 'App';
						case 'userModule': return 'App.User';
						default: return 'unknown';
					}
				});
				
				// Act
				const { pathToManager } = (wirer as any).extractPathMappings(
					[mockManagers[0], mockManagers[1]], 
					casePathExtractor,
					{ separator: '.' }
				);
				
				// Assert
				expect(pathToManager.has('app')).toBe(true);
				expect(pathToManager.has('app.user')).toBe(true);
				expect(pathToManager.get('app')).toBe(mockManagers[0]);
				expect(pathToManager.get('app.user')).toBe(mockManagers[1]);
			});
			
			it('works with custom path separator', () => {
				// Arrange
				const slashPathExtractor = jest.fn((manager: DomainStateManager) => {
					const mockManager = manager as MockDomainManager;
					switch (mockManager.managerId) {
						case 'app': return 'app';
						case 'userModule': return 'app/user';
						case 'profileService': return 'app/user/profile';
						default: return 'unknown';
					}
				});
				
				// Act
				const { pathToManager, pathToChildren } = (wirer as any).extractPathMappings(
					[mockManagers[0], mockManagers[1], mockManagers[2]], 
					slashPathExtractor,
					{ separator: '/' }
				);
				
				// Assert
				expect(pathToManager.size).toBe(3);
				expect(pathToManager.get('app')).toBe(mockManagers[0]);
				expect(pathToManager.get('app/user')).toBe(mockManagers[1]);
				expect(pathToManager.get('app/user/profile')).toBe(mockManagers[2]);
				
				expect(pathToChildren.get('app')?.length).toBe(1);
				expect(pathToChildren.get('app')).toContain('app/user');
				
				expect(pathToChildren.get('app/user')?.length).toBe(1);
				expect(pathToChildren.get('app/user')).toContain('app/user/profile');
			});
			
			it('initializes empty children arrays for leaf nodes', () => {
				// Act
				const { pathToChildren } = (wirer as any).extractPathMappings(
					mockManagers, 
					mockPathExtractor,
					{ separator: '.' }
				);
				
				// Assert
				// Each path should have an entry in the map, even if it has no children
				expect(pathToChildren.has('app.user.profile')).toBe(true);
				expect(pathToChildren.has('app.auth')).toBe(true);
				expect(pathToChildren.has('app.conditioning')).toBe(true);
				expect(pathToChildren.get('app.user.profile')?.length).toBe(0);
				expect(pathToChildren.get('app.auth')?.length).toBe(0);
				expect(pathToChildren.get('app.conditioning')?.length).toBe(0);
			});

			it('throws if two managers claim the same path', () => {
				// Arrange
				const conflictingManagers = [
					new MockDomainManager('conflict1'),
					new MockDomainManager('conflict2')
				];
				const conflictingPathExtractor = jest.fn((manager: DomainStateManager) => {
					return 'app.user'; // Both managers return the same path
				});

				// Act & Assert
				expect(() => {
					(wirer as any).extractPathMappings(
						conflictingManagers, 
						conflictingPathExtractor,
						{ separator: '.' }
					);
				}).toThrow('Two managers claim the same path: app.user');
			});
		});

		describe('registerHierarchicalComponents', () => {
			it('registers children with their parent managers', async () => {
				// Create a hierarchy Map
				const hierarchy = new Map([
					[mockManagers[0], [mockManagers[1], mockManagers[3], mockManagers[4]]],
					[mockManagers[1], [mockManagers[2]]]
				]);
				
				// Call the protected method
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				
				// Check that app has registered its children
				expect(mockManagers[0].registeredComponents.length).toBe(3);
				expect(mockManagers[0].registeredComponents).toContain(mockManagers[1]); // userModule
				expect(mockManagers[0].registeredComponents).toContain(mockManagers[3]); // authModule
				expect(mockManagers[0].registeredComponents).toContain(mockManagers[4]); // conditioningModule
				
				// Check that user module registered profile service
				expect(mockManagers[1].registeredComponents.length).toBe(1);
				expect(mockManagers[1].registeredComponents).toContain(mockManagers[2]); // profileService
				
				// Others should have no registered components
				expect(mockManagers[2].registeredComponents.length).toBe(0); // profileService
				expect(mockManagers[3].registeredComponents.length).toBe(0); // authModule
				expect(mockManagers[4].registeredComponents.length).toBe(0); // conditioningModule
			});

			it('does nothing with empty hierarchy', async () => {
				const hierarchy = new Map();
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				// Test passes if no exception is thrown
			});

			it('handles parent with no children', async () => {
				const hierarchy = new Map([
					[mockManagers[0], []]
				]);
				
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				
				expect(mockManagers[0].registeredComponents.length).toBe(0);
			});

			it('handles multiple parents with different children', async () => {
				// Reset the mock managers' registered components
				mockManagers.forEach(manager => manager.registeredComponents = []);
				
				const hierarchy = new Map([
					[mockManagers[0], [mockManagers[1]]],
					[mockManagers[3], [mockManagers[4]]]
				]);
				
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				
				expect(mockManagers[0].registeredComponents.length).toBe(1);
				expect(mockManagers[0].registeredComponents).toContain(mockManagers[1]);
				
				expect(mockManagers[3].registeredComponents.length).toBe(1);
				expect(mockManagers[3].registeredComponents).toContain(mockManagers[4]);
			});

			it('handles failed registration gracefully', async () => {
				// Create a manager that will fail registration
				const stubManager = new MockDomainManager('stubManager');
				stubManager.registerSubcomponent = jest.fn().mockReturnValue(false);
				
				const hierarchy = new Map([
					[stubManager, [mockManagers[1]]]
				]);
				
				// Should not throw an exception
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				
				expect(stubManager.registerSubcomponent).toHaveBeenCalledWith(mockManagers[1]);
			});

			it('logs warning when registration fails', async () => {
				// Arrange
				const stubManager = new MockDomainManager('stubManager');
				stubManager.registerSubcomponent = jest.fn().mockReturnValue(false);

				const hierarchy = new Map([
					[stubManager, [mockManagers[1]]]
				]);

				const logSpy = jest.spyOn(wirer.logger, 'warn');

				// Act
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				await new Promise(resolve => setTimeout(resolve, 1500)); // Allow async logging to complete

				
				// Assert
				// Check that a warning log was 
				expect(logSpy).toHaveBeenCalled();
				expect(logSpy).toHaveBeenCalledTimes(1);
				expect(logSpy).toHaveBeenCalledWith('Failed to register subcomponent MockDomainManager in MockDomainManager');
			});

			it('logs warning when registration throws an error', async () => {
				// Arrange
				const stubManager = new MockDomainManager('stubManager');
				stubManager.registerSubcomponent = jest.fn().mockImplementation(() => {
					throw new Error('Registration error');
				});

				const hierarchy = new Map([
					[stubManager, [mockManagers[1]]]
				]);

				const logSpy = jest.spyOn(wirer.logger, 'warn');

				// Act
				await (wirer as any).registerHierarchicalComponents(hierarchy);
				await new Promise(resolve => setTimeout(resolve, 1500)); // Allow async logging to complete

				
				// Assert
				expect(logSpy).toHaveBeenCalled();
				expect(logSpy).toHaveBeenCalledTimes(1);
				expect(logSpy).toHaveBeenCalledWith('Exception during subcomponent registration of MockDomainManager in MockDomainManager');
			});
		});

		describe('registerParentChildRelationship', () => {
			it('registers a path as child of its parent path', () => {
				// Arrange
				const path = 'app.user.profile';
				const separator = '.';
				const pathToChildren = new Map<string, string[]>();
				
				// Act
				(wirer as any).registerParentChildRelationship(path, separator, pathToChildren);
				
				// Assert
				expect(pathToChildren.has('app.user')).toBe(true);
				expect(pathToChildren.get('app.user')).toContain('app.user.profile');
				expect(pathToChildren.get('app.user')?.length).toBe(1);
			});

			it('does nothing with single-segment paths', () => {
				// Arrange
				const path = 'app';
				const separator = '.';
				const pathToChildren = new Map<string, string[]>();
				
				// Act
				(wirer as any).registerParentChildRelationship(path, separator, pathToChildren);
				
				// Assert
				expect(pathToChildren.size).toBe(0);
			});

			it('adds path to existing children list', () => {
				// Arrange
				const path1 = 'app.user.profile';
				const path2 = 'app.user.settings';
				const separator = '.';
				const pathToChildren = new Map<string, string[]>();
				
				// Act
				(wirer as any).registerParentChildRelationship(path1, separator, pathToChildren);
				(wirer as any).registerParentChildRelationship(path2, separator, pathToChildren);
				
				// Assert
				expect(pathToChildren.get('app.user')?.length).toBe(2);
				expect(pathToChildren.get('app.user')).toContain('app.user.profile');
				expect(pathToChildren.get('app.user')).toContain('app.user.settings');
			});

			it('handles custom path separator', () => {
				// Arrange
				const path = 'app/user/profile';
				const separator = '/';
				const pathToChildren = new Map<string, string[]>();
				
				// Act
				(wirer as any).registerParentChildRelationship(path, separator, pathToChildren);
				
				// Assert
				expect(pathToChildren.has('app/user')).toBe(true);
				expect(pathToChildren.get('app/user')).toContain('app/user/profile');
			});

			it('handles paths with empty segments correctly', () => {
				// Arrange
				const path = 'app..profile';
				const separator = '.';
				const pathToChildren = new Map<string, string[]>();
				
				// Act
				(wirer as any).registerParentChildRelationship(path, separator, pathToChildren);
				
				// Assert
				expect(pathToChildren.has('app.')).toBe(true);
				expect(pathToChildren.get('app.')).toContain('app..profile');
			});

			it('handles multi-level hierarchy correctly', () => {
				// Arrange
				const pathToChildren = new Map<string, string[]>();
				const paths = [
					'app',
					'app.user',
					'app.user.profile',
					'app.user.profile.settings'
				];
				
				// Act
				// Register all paths
				for (const path of paths) {
					(wirer as any).registerParentChildRelationship(path, '.', pathToChildren);
				}
				
				// Assert
				// 'app' should be a key in the map because it's the parent of 'app.user'
				expect(pathToChildren.has('app')).toBe(true);
				
				// 'app.user' is child of 'app'
				expect(pathToChildren.get('app')).toContain('app.user');
				
				// 'app.user.profile' is child of 'app.user'
				expect(pathToChildren.get('app.user')).toContain('app.user.profile');
				
				// 'app.user.profile.settings' is child of 'app.user.profile'
				expect(pathToChildren.get('app.user.profile')).toContain('app.user.profile.settings');
			});
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
	
	describe('Integration', () => {
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
});