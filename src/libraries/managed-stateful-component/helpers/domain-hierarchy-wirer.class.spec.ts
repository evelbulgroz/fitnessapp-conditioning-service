import DomainHierarchyWirer from './domain-hierarchy-wirer.class';
import DomainStateManager from './domain-state-manager.class';
import DomainPathExtractor from '../models/domain-path-extractor.model';

// Create mock implementation of DomainStateManager for testing
class MockDomainManager extends DomainStateManager {
	public readonly managerId: string;
	public registeredComponents: DomainStateManager[] = [];

	constructor(managerId: string, options?: any) {
		super(options);
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
	let mockPathExtractor: jest.MockedFunction<DomainPathExtractor>;

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
					'/'
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

			it('handles empty manager list', () => {
				const hierarchy = (wirer as any).buildHierarchy(
					[], 
					mockPathExtractor,
					'.'
				);
				
				expect(hierarchy.size).toBe(0);
			});

			it('handles flat structure with no hierarchy', () => {
				// Mock extractor that returns the same level for all managers
				const flatExtractor = jest.fn(() => 'app');
				
				const hierarchy = (wirer as any).buildHierarchy(
					mockManagers, 
					flatExtractor,
					'.'
				);
				
				expect(hierarchy.size).toBe(0); // No parent-child relationships
			});
		});
	});

	describe('integration', () => {
		xit('builds a complete hierarchy with virtual paths', async () => {
			// Add a manager with a virtual path option
			const virtualPathManager = new MockDomainManager('virtualModule', {
				virtualPath: 'app.virtual.custom'
			});
			
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