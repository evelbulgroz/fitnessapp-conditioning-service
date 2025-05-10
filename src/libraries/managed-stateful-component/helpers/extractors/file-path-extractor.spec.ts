import { filePathExtractor } from './file-path-extractor';
import DomainStateManager from '../domain-state-manager.class';

// Mock DomainStateManager for testing
class MockDomainManager extends DomainStateManager {
	constructor(filename?: string) {
		super();
		if (filename) {
			(this as any).__filename = filename;
		}
	}
}

describe('filePathExtractor', () => {
	describe('Basic functionality', () => {
		it('extracts correct path from Windows-style file path', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\version-control\\projects\\fitnessapp-conditioning-service\\src\\conditioning\\conditioning-domain-state-manager.ts'
			);
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert
			expect(result).toBe('app.src.conditioning');
		});

		it('extracts correct path from Unix-style file path', () => {
			// Arrange
			const manager = new MockDomainManager(
				'/home/user/fitnessapp-conditioning-service/src/user/user-domain-state-manager.ts'
			);
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert
			expect(result).toBe('app.src.user');
		});

		it('falls back to constructor name when no filename is provided', () => {
			// Arrange
			const manager = new MockDomainManager();
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert
			expect(result).toBe('mockdomain'); // "MockDomainManager" -> "mockdomain"
		});
	});

	describe('Path normalization', () => {
		it('handles different file extensions', () => {
			// Arrange
			const tsManager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\auth\\auth-manager.ts'
			);
			const jsManager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\auth\\auth-manager.js'
			);
			
			// Act
			const tsResult = filePathExtractor(tsManager);
			const jsResult = filePathExtractor(jsManager);
			
			// Assert
			expect(tsResult).toBe('app.src.auth');
			expect(jsResult).toBe('app.src.auth');
		});

		it('handles .dist.src patterns in path', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\dist\\src\\conditioning\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert
			expect(result).toBe('app.conditioning');
		});

		it('normalizes paths to lowercase', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\Auth\\USER-manager.ts'
			);
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert
			expect(result).toBe('app.src.auth');
		});
	});

	describe('Edge cases', () => {
		it('handles leading and trailing separators', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\\\src\\auth\\'
			);
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert
			expect(result).toBe('app.auth');
		});

		it('supports custom appRootName', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\analytics\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(manager, 'fitness');
			
			// Assert
			expect(result).toBe('fitness.src.analytics');
		});

		it('handles paths with no project root match', () => {
			// Arrange - path doesn't contain the expected project root
			const manager = new MockDomainManager(
				'd:\\other-project\\src\\feature\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(manager);
			
			// Assert - should still produce a reasonable result
			expect(result.startsWith('app')).toBeTruthy();
		});
	});
});