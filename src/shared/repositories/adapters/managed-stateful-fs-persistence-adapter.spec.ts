import { EntityDTO, EntityMetadataDTO, EntityPersistenceDTO } from '@evelbulgroz/ddd-base';
import * as fs from 'fs';
import { ManagedStatefulFsPersistenceAdapter } from './managed-stateful-fs-persistence-adapter';

// Mock fs module to avoid actual file system operations
jest.mock('fs', () => ({
	existsSync: jest.fn().mockReturnValue(true),
	mkdirSync: jest.fn(),
	writeFileSync: jest.fn(),
	readFileSync: jest.fn().mockReturnValue('[]'),
	readdirSync: jest.fn().mockReturnValue([]),
}));

// Define a simple type that satisfies the generic constraint
interface TestEntityDTO extends EntityDTO {
	name: string;
}

interface TestMetadataDTO extends EntityMetadataDTO {
	createdBy: string;
}

interface TestPersistenceDTO extends EntityPersistenceDTO<TestEntityDTO, TestMetadataDTO> {
	entityId: string;
	name: string;
	createdBy: string;
	createdOn: string;
	updatedOn: string;
}

describe('ManagedStatefulFsPersistenceAdapter', () => {
	const testStoragePath = './test-storage';
	let adapter: ManagedStatefulFsPersistenceAdapter<TestPersistenceDTO>;

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks();
		
		// Create a new instance for each test
		adapter = new ManagedStatefulFsPersistenceAdapter<TestPersistenceDTO>(testStoragePath);
	});

	it('can be instantiated successfully', () => {
		expect(adapter).toBeDefined();
		expect(adapter).toBeInstanceOf(ManagedStatefulFsPersistenceAdapter);
	});

	it('inherits fetchById method from FileSystemPersistenceAdapter', () => {
		// Verify the method exists
		expect(adapter.fetchById).toBeDefined();
		expect(typeof adapter.fetchById).toBe('function');
		
		// Optional: Test with a basic call
		const testId = '123';
		adapter.fetchById(testId);
		
		// Verify fs methods were called appropriately
		// This indicates the base class method is working
		expect(fs.existsSync).toHaveBeenCalled();
		expect(fs.readFileSync).toHaveBeenCalled();
	});

	it('inherits componentState$ observable from ManagedStatefulComponentMixin', () => {
		expect(adapter.componentState$).toBeDefined();
		
		// Verify it's an observable by checking if it has subscribe method
		expect(adapter.componentState$.subscribe).toBeDefined();
		expect(typeof adapter.componentState$.subscribe).toBe('function');
	});
});