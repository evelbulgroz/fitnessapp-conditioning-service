import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';

import path from 'path';

import AppHealthController from './app-health.controller';
import AppHealthService from '../services/app-health.service';
import { ComponentState } from '../../libraries/managed-stateful-component';
import HealthCheckResponse from '../../conditioning/controllers/models/health-check-response.model';
import { HealthConfig } from '../../shared/domain/config-options.model';
import LivenessCheckResponse from '../../conditioning/controllers/models/liveliness-check-response.model';
import ReadinessCheckResponse from '../../conditioning/controllers/models/readiness-check-response.model';
import StartupCheckResponse from '../../conditioning/controllers/models/startup-check-response.model';

describe('AppHealthController', () => {
	let controller: AppHealthController;
	let appHealthService: jest.Mocked<AppHealthService>;
	let mockResponse: any;
	beforeEach(async () => {
		// Create mock implementations
		appHealthService = {
			fetchHealthCheckResponse: jest.fn(),
			fetchLivenessCheckResponse: jest.fn(),
			fetchReadinessCheckResponse: jest.fn(),
			fetchStartupCheckResponse: jest.fn(),
			getHealthConfig: () => ({
				storage: {
					dataDir: path.join('D:\\'), // Default data directory
					maxStorageLimit: 0.9, // 90% of available storage
				},
				memory: {
					maxHeapSize: 10 * 150 * 1024 * 1024, // 1500 MB
					maxRSSsize: 10 * 150 * 1024 * 1024, // 1500 MB
				},
				timeouts: { // 10x accelerated timeouts for testing
					healthz: 250,
					livenessz: 100,
					readinessz: 250,
					startupz: 250
				}
			} as HealthConfig),
			withTimeout: jest.fn()
		} as any;

		// Create mock response object
		mockResponse = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis()
		};

		// Create module with mocked dependencies
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppHealthController],
			providers: [
				{ provide: AppHealthService, useValue: appHealthService },
			]
		})
		.compile();

		controller = module.get<AppHealthController>(AppHealthController);
		
		// Mock the controller's withTimeout method
		jest.spyOn(controller as any, 'withTimeout').mockImplementation(
			(promise) => promise
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(controller).toBeDefined();
	});

	describe('Public API', () => {
		describe('checkHealth', () => {
			it('calls service and returns 200 when app is healthy', async () => {
				// Arrange
				const healthResponse: HealthCheckResponse = {
					status: 'up',
					info: {
						app: {
							status: 'up',
							state: {
								name: 'app',
								state: ComponentState.OK,
								updatedOn: new Date(),
								components: []		
							}
						}				
					},
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchHealthCheckResponse.mockResolvedValue(healthResponse);

				// Act
				await controller.checkHealth(mockResponse);

				// Assert
				expect(appHealthService.fetchHealthCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
				expect(mockResponse.send).toHaveBeenCalledWith(healthResponse);
			});

			it('returns 503 when app is degraded', async () => {
				// Arrange
				const healthResponse: HealthCheckResponse = {
					status: 'down',
					info: {
						app: {
							status: 'down',
							state: {
								name: 'app',
								state: ComponentState.DEGRADED,
								updatedOn: new Date(),
								components: []
							}
						}
					},
					error: {
						message: 'Some components are degraded'
					},
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchHealthCheckResponse.mockResolvedValue(healthResponse);

				// Act
				await controller.checkHealth(mockResponse);

				// Assert
				expect(appHealthService.fetchHealthCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({ status: 'down', error: expect.any(Object) })
				);
			});

			it('handles errors and returns 503', async () => {
				// Arrange
				const error = new Error('Test error');
				appHealthService.fetchHealthCheckResponse.mockRejectedValue(error);

				// Act
				await controller.checkHealth(mockResponse);

				// Assert
				expect(appHealthService.fetchHealthCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({ status: 'down', error: 'Test error' })
				);
			});

			it('times out health check after delay set in config', async () => {
				// Arrange
				const now = new Date();
				const timeout = appHealthService.getHealthConfig()?.timeouts.healthz;
				const timeoutError = new Error(`Operation timed out after ${timeout}ms`);
				
				jest.spyOn(controller as any, 'withTimeout').mockRejectedValueOnce(timeoutError); // Re-mock withTimeout to simulate timeout

				appHealthService.fetchHealthCheckResponse.mockResolvedValueOnce({
					status: 'up',
					info: { app: { status: 'up', state: { name: 'app', state: ComponentState.OK, updatedOn: new Date(), components: [] } } },
					timestamp: now.toISOString()
				});

				// Act
				await controller.checkHealth(mockResponse);

				// Assert
				expect(appHealthService.fetchHealthCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'down',
						error: `Health check timed out after ${timeout}ms`,
						timestamp: expect.any(String)
					})
				);

				// Clean up
				jest.clearAllMocks();
			});
		});

		describe('checkLiveness', () => {
			it(`calls service and returns 'up' if app is live`, async () => {
				// Arrange
				const livenessResponse: LivenessCheckResponse = { status: 'up', timestamp: new Date().toISOString() };
				appHealthService.fetchLivenessCheckResponse.mockResolvedValue(livenessResponse);

				// Act
				await controller.checkLiveness(mockResponse);  // Don't assign to result

				// Assert
				expect(appHealthService.fetchLivenessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK); // Assert HTTP status
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
					status: 'up',
					timestamp: expect.any(String)
					})
				);
			});

			it('times out liveness check after delay set in config', async () => {
				// Arrange
				const now = new Date();
				const timeout = appHealthService.getHealthConfig()?.timeouts.livenessz;
				const timeoutError = new Error(`Operation timed out after ${timeout}ms`);
				
				jest.spyOn(controller as any, 'withTimeout').mockRejectedValueOnce(timeoutError); // Re-mock withTimeout to simulate timeout
				appHealthService.fetchLivenessCheckResponse.mockResolvedValueOnce({ status: 'up', timestamp: now.toISOString() }); // Mock the service to return a response
				
				// Act
				await controller.checkLiveness(mockResponse);

				// Assert
				expect(appHealthService.fetchLivenessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'down',
						error: `Liveness check timed out after ${timeout}ms`
					})
				);

				// Clean up
				jest.clearAllMocks();
			});
		});

		describe('checkReadiness', () => {
			it('calls service and returns 200 when ready', async () => {
				// Arrange
				const readinessResponse: ReadinessCheckResponse = {
					status: 'up',
					info: {
						'module-state': { status: 'up' },
						storage: { status: 'up' },
						memory_heap: { status: 'up' },
						memory_rss: { status: 'up' }
					},
					error : {},
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchReadinessCheckResponse.mockResolvedValue(readinessResponse);

				// Act
				await controller.checkReadiness(mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
				expect(mockResponse.send).toHaveBeenCalledWith(readinessResponse);
			});

			it('returns 503 when not ready', async () => {
				// Arrange
				const readinessResponse: ReadinessCheckResponse = {
					status: 'down',
					info: {
						'module-state': { status: 'up' },
						memory_heap: { status: 'up' },
						memory_rss: { status: 'up' }
					},
					error : {
						storage: { status: 'down', reason: 'Disk full' }
					},
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchReadinessCheckResponse.mockResolvedValue(readinessResponse);

				// Act
				await controller.checkReadiness(mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining(readinessResponse)
				);
			});

			it('handles errors and returns 503 with error message', async () => {
				// Arrange
				const error = new Error('Test error');
				appHealthService.fetchReadinessCheckResponse.mockRejectedValue(error);

				// Act
				await controller.checkReadiness(mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'down',
						info: {},
						error: {message: error.message},
						timestamp: expect.any(String)
					})
				);
			});

			it('times out readiness check after delay set in config', async () => {
				// Arrange
				const now = new Date();
				const readinessResponse: ReadinessCheckResponse = {
					status: 'up',
					info: {
						'module-state': { status: 'up' },
						storage: { status: 'up' },
						memory_heap: { status: 'up' },
						memory_rss: { status: 'up' }
					},
					error: {},
					timestamp: now.toISOString()
				};
				const timeout = appHealthService.getHealthConfig()?.timeouts.readinessz;
				const timeoutError = new Error(`Operation timed out after ${timeout}ms`);
				
				jest.spyOn(controller as any, 'withTimeout').mockRejectedValueOnce(timeoutError); // Re-mock withTimeout to simulate timeout
				appHealthService.fetchReadinessCheckResponse.mockResolvedValueOnce(readinessResponse); // Mock the service to return a response

				// Act
				await controller.checkReadiness(mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'down',
						error: {message: `Readiness check timed out after ${timeout}ms`},
						timestamp: expect.any(String) // Use any to avoid strict date comparison
					})
				);

				// Clean up
				jest.clearAllMocks();
			});
		});

		describe('checkStartup', () => {
			it('calls service and return 200 when started', async () => {
				// Arrange
				const startupResponse: StartupCheckResponse = {
					status: 'started',
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchStartupCheckResponse.mockResolvedValue(startupResponse);

				// Act
				await controller.checkStartup(mockResponse);

				// Assert
				expect(appHealthService.fetchStartupCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
				expect(mockResponse.send).toHaveBeenCalledWith(startupResponse);
			});

			it('returns 503 when still starting', async () => {
				// Arrange
				const startupResponse: StartupCheckResponse = {
					status: 'starting',
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchStartupCheckResponse.mockResolvedValue(startupResponse);

				// Act
				await controller.checkStartup(mockResponse);

				// Assert
				expect(appHealthService.fetchStartupCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(startupResponse);
			});

			it('handles errors and return 503 with starting status', async () => {
				// Arrange
				const error = new Error('Something went wrong');
				appHealthService.fetchStartupCheckResponse.mockRejectedValue(error);

				// Act
				await controller.checkStartup(mockResponse);

				// Assert
				expect(appHealthService.fetchStartupCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'starting',
						message: 'Something went wrong'
					})
				);
			});

			it('times out startup check after delay set in config', async () => {
				// Arrange
				const now = new Date();
				const timeout = appHealthService.getHealthConfig()?.timeouts.startupz;
				const timeoutError = new Error(`Operation timed out after ${timeout}ms`);			
				
				jest.spyOn(controller as any, 'withTimeout').mockRejectedValueOnce(timeoutError); // Re-mock withTimeout to simulate timeout

				appHealthService.fetchStartupCheckResponse.mockResolvedValueOnce({ // Mock the service to return a response
					status: 'starting',
					timestamp: expect.any(String) // Use any to avoid strict date comparison
				});				
				
				// Act
				await controller.checkStartup(mockResponse);
				
				// Assert
				expect(appHealthService.fetchStartupCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith({
					status: 'starting',
					message: `Startup check timed out after ${timeout}ms`,
					timestamp: expect.any(String) // Use any to avoid strict date comparison
				});

				// Clean up
				jest.clearAllMocks();
			});
		});
	});

	describe('Private methods', () => {
		describe('withTimeout', () => {
			it('resolves within timeout', async () => {
				// Arrange
				const promise = Promise.resolve('Success');
				const timeout = 250;

				// Act
				const result = await controller['withTimeout'](promise, timeout);

				// Assert
				expect(result).toBe('Success');
			});

			it('rejects with timeout error', async () => {
				// Arrange
				jest.useFakeTimers(); // Use fake timers to control timeouts
				jest.spyOn(controller as any, 'withTimeout').mockRestore(); // Restore the original method
				
				const promise = new Promise((resolve) => setTimeout(resolve, 10000, 'Success'));
				
				const timeout = 250;
				const resultPromise = controller['withTimeout'](promise, timeout);
				
				jest.advanceTimersByTime(251); // Fast-forward time to trigger timeout
				await Promise.resolve(); // Ensure all promises are resolved to ensure the timeout is processed

				// Act & Assert
				await expect(resultPromise).rejects.toThrow(`Operation timed out after ${timeout}ms`);

				// Cleanup
    			jest.useRealTimers();
			});
		});
	});
});