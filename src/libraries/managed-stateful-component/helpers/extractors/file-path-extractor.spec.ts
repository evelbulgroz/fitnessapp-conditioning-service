import { filePathExtractor } from './file-path-extractor';
import DomainStateManager from '../domain-state-manager.class';
import { normalize } from 'path';

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
			
			// Act - specify a matching source root
			const result = filePathExtractor(
				manager,
				'app',
				'd:\\version-control\\projects\\fitnessapp-conditioning-service'
			);
			
			// Assert
			expect(result).toBe('app.src.conditioning');
		});

		it('extracts correct path from Unix-style file path', () => {
			// Arrange
			const manager = new MockDomainManager(
				'/home/user/fitnessapp-conditioning-service/src/user/user-domain-state-manager.ts'
			);
			
			// Act - specify a matching source root
			const result = filePathExtractor(
				manager,
				'app',
				'/home/user/fitnessapp-conditioning-service'
			);
			
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

	describe('Path Normalization', () => {
		it('handles different file extensions', () => {
			// Arrange
			const tsManager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\auth\\auth-manager.ts'
			);
			const jsManager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\auth\\auth-manager.js'
			);
			
			// Act
			const tsResult = filePathExtractor(
				tsManager, 
				'app',
				'd:\\fitnessapp-conditioning-service'
			);
			const jsResult = filePathExtractor(
				jsManager,
				'app',
				'd:\\fitnessapp-conditioning-service'
			);
			
			// Assert
			expect(tsResult).toBe('app.src.auth');
			expect(jsResult).toBe('app.src.auth');
		});

		it('handles paths with dist in them', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\dist\\src\\conditioning\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(
				manager,
				'app',
				'd:\\fitnessapp-conditioning-service'
			);
			
			// Assert
			expect(result).toBe('app.dist.src.conditioning');
		});

		it('normalizes paths to lowercase', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\Auth\\USER-manager.ts'
			);
			
			// Act
			const result = filePathExtractor(
				manager,
				'app',
				'd:\\fitnessapp-conditioning-service'
			);
			
			// Assert
			expect(result).toBe('app.src.auth');
		});
	});

	describe('Edge Cases', () => {
		it('handles leading and trailing separators in file paths', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\\\src\\auth\\'
			);
			
			// Act
			const result = filePathExtractor(
				manager,
				'app', 
				'd:\\fitnessapp-conditioning-service'
			);
			
			// Assert
			expect(result).toBe('app.src.auth');
		});

		it('supports custom appRootName', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\analytics\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(
				manager, 
				'fitness',
				'd:\\fitnessapp-conditioning-service',
			);
			
			// Assert
			expect(result).toBe('fitness.src.analytics');
		});

		it('handles paths with no project root match', () => {
			// Arrange - path doesn't contain the expected project root
			const manager = new MockDomainManager(
				'd:\\other-project\\src\\feature\\manager.ts'
			);
			
			// Act - use a root that doesn't match
			const result = filePathExtractor(
				manager,
				'app',
				'c:\\completely-different'
			);
			
			// Assert - should still produce a reasonable result
			expect(result).toBe('app.d.other-project.src.feature');
		});
	});

	describe('Separator Parameter', () => {
		it('uses custom separator when provided', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\auth\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(
				manager, 
				'app',
				'd:\\fitnessapp-conditioning-service',
				'/'
			);
			
			// Assert
			expect(result).toBe('app/src/auth');
		});
		

		it('handles different custom separators', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\auth\\manager.ts'
			);
			
			// Act - test with different separators
			const dashResult = filePathExtractor(
				manager, 
				'app',
				'd:\\fitnessapp-conditioning-service',
				'-'
			);
			const colonResult = filePathExtractor(
				manager, 
				'app',
				'd:\\fitnessapp-conditioning-service',
				':'
			);
			
			// Assert
			expect(dashResult).toBe('app-src-auth');
			expect(colonResult).toBe('app:src:auth');
		});
		
		it('sanitizes multiple consecutive separators', () => {
			// Arrange
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service\\src\\\\auth\\\\\\manager.ts'
			);
			
			// Act
			const result = filePathExtractor(
				manager, 
				'app',
				'd:\\fitnessapp-conditioning-service',
				'.'
			);
			
			// Assert - should have no double dots
			expect(result).toBe('app.src.auth');
			expect(result).not.toContain('..');
		});
	});
	
	describe('Cross-Platform Compatibility', () => {
		it('handles mixed path separators', () => {
			// Arrange - path with mixed separators
			const manager = new MockDomainManager(
				'd:\\fitnessapp-conditioning-service/src\\auth/manager.ts'
			);
			
			// Act
			const result = filePathExtractor(
				manager,
				'app',
				'd:\\fitnessapp-conditioning-service'
			);
			
			// Assert
			expect(result).toBe('app.src.auth');
		});
		
		it('works with current working directory as default source root', () => {
			// Arrange
			const manager = new MockDomainManager(
				`${process.cwd()}\\src\\feature\\manager.ts`
			);
			
			// Act - don't specify sourceRoot to use default
			const result = filePathExtractor(manager);
			
			// Assert - should have src and feature in the path
			expect(result.includes('src')).toBeTruthy();
			expect(result.includes('feature')).toBeTruthy();
		});
	});
});