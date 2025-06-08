import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiskHealthIndicator, HealthCheckResult, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';

import { ComponentState, ComponentStateInfo } from '../../libraries/managed-stateful-component';
import AppDomainStateManager from '../../app-domain-state-manager';
import AppHealthService from './app-health.service';
import ModuleStateHealthIndicator from '../health-indicators/module-state-health-indicator';

describe('AppHealthService', () => {
	let service: AppHealthService;
	let appDomainStateManager: jest.Mocked<AppDomainStateManager>;
	let config: jest.Mocked<ConfigService>;
	let disk: jest.Mocked<DiskHealthIndicator>;
	let healthCheckService: jest.Mocked<HealthCheckService>;
	let http: jest.Mocked<HttpHealthIndicator>;
	let memory: jest.Mocked<MemoryHealthIndicator>;
	let moduleStateHealthIndicator: jest.Mocked<ModuleStateHealthIndicator>;

	beforeEach(async () => {
		// Create mock implementations
		appDomainStateManager = {
			getState: jest.fn(),
		} as any;

		config = {
			get: jest.fn(),
		} as any;

		disk = {
			checkStorage: jest.fn(),
		} as any;

		healthCheckService = {
			check: jest.fn(),
		} as any;

		http = {
			pingCheck: jest.fn(),
		} as any;

		memory = {
			checkHeap: jest.fn(),
			checkRSS: jest.fn(),
		} as any;

		moduleStateHealthIndicator = {
			isHealthy: jest.fn(),
		} as any;

		// Create the service with mocked dependencies
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AppHealthService,
				{ provide: AppDomainStateManager, useValue: appDomainStateManager },
				{ provide: ConfigService, useValue: config },
				{ provide: DiskHealthIndicator, useValue: disk },
				{ provide: HealthCheckService, useValue: healthCheckService },
				{ provide: HttpHealthIndicator, useValue: http },
				{ provide: MemoryHealthIndicator, useValue: memory },
				{ provide: ModuleStateHealthIndicator, useValue: moduleStateHealthIndicator },
			],
		})
		.compile();

		service = module.get<AppHealthService>(AppHealthService);
		
		// Set up common mock behaviors
		config.get.mockImplementation((key: string) => {
			if (key === 'health') {
				return {
					storage: { dataDir: 'D:\\', maxStorageLimit: 0.9 },
					memory: { maxHeapSize: 1500000000, maxRSSsize: 1500000000 },
					timeouts: {
						healthz: 2500,
						livenessz: 1000,
						readinessz: 5000,
						startupz: 2500
					}
				};
			}
			if (key === 'services') {
				return {
					'fitnessapp-registry-service': {
						baseURL: new URL('http://localhost:3000/registry/api/v1'),
						endpoints: { liveness: { path: '/health/livenessz' } }
					},
					'fitnessapp-authentication-service': {
						baseURL: new URL('http://localhost:3010/auth/api/v1'),
						endpoints: { liveness: { path: '/health/livenessz' } }
					},
					'fitnessapp-user-service': {
						baseURL: new URL('http://localhost:3020/user/api/v1'),
						endpoints: { liveness: { path: '/health/livenessz' } }
					}
				};
			}
			return undefined;
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Public API', () => {
		describe('fetchHealthCheckResponse', () => {
			test('returns up status when app state is OK', async () => {
				// Arrange
				const stateInfo: ComponentStateInfo = {
					name: 'app',
					state: ComponentState.OK,
					updatedOn: new Date(),
					components: [] // should be removed from response
				};
				appDomainStateManager.getState.mockResolvedValue(stateInfo);

				// Act
				const result = await service.fetchHealthCheckResponse();

				// Assert
				expect(result.status).toBe('up');
				expect(result.info.app.status).toBe('up');
				expect(result.info.app.state).toEqual(expect.objectContaining({
					state: ComponentState.OK
				}));
				expect(result.info.app.state.components).toBeUndefined(); // Should be removed
			});

			test('returns down status when app state is degraded', async () => {
				// Arrange
				const stateInfo = {
					name: 'app',
					state: ComponentState.DEGRADED,
					reason: 'Some dependency is not available',
					updatedOn: new Date()
				};
				appDomainStateManager.getState.mockResolvedValue(stateInfo);

				// Act
				const result = await service.fetchHealthCheckResponse();

				// Assert
				expect(result.status).toBe('down');
				expect(result.info.app.status).toBe('down');
				expect(result.info.app.state).toEqual(stateInfo);
			});

			test('throws error when app state is not available', async () => {
				// Arrange
				appDomainStateManager.getState.mockResolvedValue(null as any);

				// Act & Assert
				await expect(service.fetchHealthCheckResponse()).rejects.toEqual(
					expect.objectContaining({
						status: 'down',
						error: { message: 'Application state is not available' }
					})
				);
			});
		});

		describe('fetchLivenessCheckResponse', () => {
			test('always returns up status', async () => {
				// Act
				const result = await service.fetchLivenessCheckResponse();

				// Assert
				expect(result).toEqual({ status: 'up' });
			});
		});

		describe('fetchReadinessCheckResponse', () => {
			test('returns up status when all health checks pass', async () => {
				// Arrange
				const healthCheckResult: HealthCheckResult = {
					status: 'ok',
					info: {
						'memory_heap': { status: 'up' },
						'memory_rss': { status: 'up' },
						'storage': { status: 'up' },
						'module-state': { status: 'up' }
					},
					error: {},
					details: {
						'memory_heap': { status: 'up' },
						'memory_rss': { status: 'up' },
						'storage': { status: 'up' },
						'module-state': { status: 'up' }
					}
				};
				healthCheckService.check.mockResolvedValue(healthCheckResult);

				// Act
				const result = await service.fetchReadinessCheckResponse();

				// Assert
				expect(result.status).toBe('up');
				expect(result.info).toBe(healthCheckResult.info);
				expect(result.error).toBe(healthCheckResult.error);
				expect(result.details).toBe(healthCheckResult.details);
				expect(healthCheckService.check).toHaveBeenCalledWith(expect.arrayContaining([
					expect.any(Function), // moduleStateHealthIndicator.isHealthy
					expect.any(Function), // disk.checkStorage
					expect.any(Function), // memory.checkHeap
					expect.any(Function), // memory.checkRSS
					expect.any(Function), // http.pingCheck for registry
					expect.any(Function), // http.pingCheck for auth
					expect.any(Function)	// http.pingCheck for user
				]));
			});

			test('throws health check result when any check fails', async () => {
				// Arrange
				const healthCheckError = new Error('Health check failed') as any;
				healthCheckError.response = {
					status: 'error',
					error: {
						'memory_heap': { status: 'down', message: 'Memory usage too high' }
					},
					info: {},
					details: {}
				};
				healthCheckService.check.mockRejectedValue(healthCheckError);

				// Act & Assert
				await expect(service.fetchReadinessCheckResponse()).rejects.toEqual(healthCheckError.response);
			});
		});

		describe('fetchStartupCheckResponse', () => {
			test('returns started status when app state is OK', async () => {
				// Arrange
				const stateInfo = {
					name: 'app',
					state: ComponentState.OK,
					updatedOn: new Date()
				};
				appDomainStateManager.getState.mockResolvedValue(stateInfo);

				// Act
				const result = await service.fetchStartupCheckResponse();

				// Assert
				expect(result.status).toBe('started');
				expect(result.timestamp).toBe(stateInfo.updatedOn.toISOString());
			});

			test('returns started status when app state is DEGRADED', async () => {
				// Arrange
				const stateInfo = {
					name: 'app',
					state: ComponentState.DEGRADED,
					updatedOn: new Date()
				};
				appDomainStateManager.getState.mockResolvedValue(stateInfo);

				// Act
				const result = await service.fetchStartupCheckResponse();

				// Assert
				expect(result.status).toBe('started');
			});

			test('returns starting status when app state is not OK or DEGRADED', async () => {
				// Arrange
				const stateInfo = {
					name: 'app',
					state: ComponentState.INITIALIZING,
					updatedOn: new Date()
				};
				appDomainStateManager.getState.mockResolvedValue(stateInfo);

				// Act
				const result = await service.fetchStartupCheckResponse();

				// Assert
				expect(result.status).toBe('starting');
			});

			test('throws error when app state is not available', async () => {
				// Arrange
				appDomainStateManager.getState.mockResolvedValue(null as any);

				// Act & Assert
				await expect(service.fetchStartupCheckResponse()).rejects.toEqual(
					expect.objectContaining({
						status: 'starting',
						message: 'Application state is not available'
					})
				);
			});
		});

		describe('mapHealthCheckResultToReadinessResponse', () => {
			test('correctly maps successful health check result', () => {
				// Arrange
				const now = new Date();
				const healthCheck = {
					status: 'ok',
					info: {
						'memory_heap': { status: 'up', used: 100, available: 1000 },
						'module-state': { status: 'up', extraInfo: 'should be removed' }
					},
					error: {},
					details: { someDetails: true }
				};

				// Act
				const result = service.mapHealthCheckResultToReadinessResponse(healthCheck as any, now);

				// Assert
				expect(result).toEqual({
					status: 'up',
					info: {
						'memory_heap': { status: 'up', used: 100, available: 1000 },
						'module-state': { status: 'up' } // Reduced info
					},
					error: {},
					details: { someDetails: true },
					timestamp: now.toISOString()
				});
			});

			test('correctly maps failed health check result', () => {
				// Arrange
				const now = new Date();
				const healthCheck = {
					status: 'error',
					info: {},
					error: {
						'module-state': { status: 'down', reason: 'Database connection failed', extra: 'to be removed' }
					},
					details: {}
				};

				// Act
				const result = service.mapHealthCheckResultToReadinessResponse(healthCheck as any, now);

				// Assert
				expect(result).toEqual({
					status: 'down',
					info: {},
					error: {
						'module-state': { status: 'down', reason: 'Database connection failed' } // Keeps reason but removes extra
					},
					details: {},
					timestamp: now.toISOString()
				});
			});
		});
	});

	describe('Private Methods', () => {
		describe('getHealthConfig', () => {
			test('returns config with defaults merged with retrieved config', () => {
				// Arrange - config.get already mocked in beforeEach

				// Act
				const result = (service as any).getHealthConfig();

				// Assert
				expect(result).toEqual({
					storage: { dataDir: 'D:\\', maxStorageLimit: 0.9 },
					memory: { maxHeapSize: 1500000000, maxRSSsize: 1500000000 },
					timeouts: {
						healthz: 2500,
						livenessz: 1000,
						readinessz: 5000,
						startupz: 2500
					}
				});
			});

			test('returns defaults when config is missing', () => {
				// Arrange
				config.get.mockImplementation(() => null);

				// Act
				const result = (service as any).getHealthConfig();

				// Assert
				expect(result).toEqual(expect.objectContaining({
					storage: expect.any(Object),
					memory: expect.any(Object),
					timeouts: expect.any(Object)
				}));
			});
		});

		describe('getServiceURL', () => {
			test('returns correct URL for existing service', () => {
				// Arrange
				const servicesConfig = {
					'test-service': {
						baseURL: new URL('http://localhost:4000/api'),
						endpoints: {
							liveness: { path: '/health/live' }
						}
					}
				};

				// Act
				const url = (service as any).getServiceURL('test-service', servicesConfig);

				// Assert
				expect(url).toBe('http://localhost:4000/api/health/live');
			});

			test('returns fallback URL when service not found', () => {
				// Arrange
				const servicesConfig = {};

				// Act
				const url = (service as any).getServiceURL('nonexistent-service', servicesConfig);

				// Assert
				expect(url).toBe('nonexistent-service-base-url-not-configured/liveness-path-not-configured');
			});
		});		
	});
});