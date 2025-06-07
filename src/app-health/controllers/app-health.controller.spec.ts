import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { Request } from 'express';

import AppHealthController from './app-health.controller';
import AppHealthService from '../services/app-health.service';
import HealthCheckResponse from '../../conditioning/controllers/models/health-check-response.model';
import LivenessCheckResponse from '../../conditioning/controllers/models/liveliness-check-response.model';
import ReadinessCheckResponse from '../../conditioning/controllers/models/readiness-check-response.model';
import StartupCheckResponse from '../../conditioning/controllers/models/startup-check-response.model';
import { HealthConfig } from '../../shared/domain/config-options.model';
import { ComponentState } from '../../libraries/managed-stateful-component';

describe('AppHealthController', () => {
	let controller: AppHealthController;
	let appHealthService: jest.Mocked<AppHealthService>;
	let configService: jest.Mocked<ConfigService>;
	let mockResponse: any;

	beforeEach(async () => {
		// Create mock implementations
		appHealthService = {
			fetchHealthCheckResponse: jest.fn(),
			fetchLivenessCheckResponse: jest.fn(),
			fetchReadinessCheckResponse: jest.fn(),
			fetchStartupCheckResponse: jest.fn(),
			//withTimeout: jest.fn()
		} as any;

		configService = {
			get: jest.fn()
		} as any;

		// Create mock response object
		mockResponse = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis()
		};

		// Default health config
		configService.get.mockImplementation((key: string) => {
			if (key === 'health') {
				return {
					timeouts: {
						healthz: 2500,
						livenessz: 1000,
						readinessz: 5000,
						startupz: 2500
					}
				};
			}
			return undefined;
		});

		// Create module with mocked dependencies
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppHealthController],
			providers: [
				{ provide: AppHealthService, useValue: appHealthService },
				{ provide: ConfigService, useValue: configService }
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
		});

		describe('checkLiveness', () => {
			it('calls service and return liveness status', async () => {
				// Arrange
				const livenessResponse: LivenessCheckResponse = { status: 'up' };
				appHealthService.fetchLivenessCheckResponse.mockResolvedValue(livenessResponse);

				// Act
				const result = await controller.checkLiveness();

				// Assert
				expect(appHealthService.fetchLivenessCheckResponse).toHaveBeenCalled();
				expect(result).toEqual(livenessResponse);
			});
		});

		describe('checkReadiness', () => {
			/*
			it('calls service and return 200 when ready', async () => {
				// Arrange
				const readinessResponse: ReadinessCheckResponse = {
					status: 'up',
					info: {},
					error: {},
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchReadinessCheckResponse.mockResolvedValue(readinessResponse);
				const mockReq = {} as Request;

				// Act
				await controller.checkReadiness(mockReq as unknown as Request, mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
				expect(mockResponse.send).toHaveBeenCalledWith(readinessResponse);
			});

			it('should return 503 when not ready', async () => {
				// Arrange
				const readinessResponse: ReadinessCheckResponse = {
					status: 'down',
					info: {},
					error: { message: 'Not ready' },
					timestamp: new Date().toISOString()
				};
				appHealthService.fetchReadinessCheckResponse.mockResolvedValue(readinessResponse);
				const mockReq = {} as Request;

				// Act
				await controller.checkReadiness(mockReq, mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(readinessResponse);
			});

			it('handles timeout errors', async () => {
				// Arrange
				const timeoutError = new Error('Operation timed out after 5000ms');
				appHealthService.fetchReadinessCheckResponse.mockRejectedValue(timeoutError);
				const mockReq = {} as Request;
				
				// Re-mock withTimeout to simulate timeout
				jest.spyOn(controller as any, 'withTimeout').mockRejectedValue(timeoutError);

				// Act
				await controller.checkReadiness(mockReq, mockResponse);

				// Assert
				expect(appHealthService.fetchReadinessCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'down',
						error: expect.objectContaining({ message: 'Readiness check timed out' })
					})
				);
			});
			*/
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
			
			xit('handles timeout errors', async () => {
				// Arrange
				const timeoutError = new Error('Operation timed out after 2500ms');
				appHealthService.fetchStartupCheckResponse.mockRejectedValue(timeoutError);
				
				// Re-mock withTimeout to simulate timeout
				jest.spyOn(controller as any, 'withTimeout').mockRejectedValue(timeoutError);

				// Act
				expect(async () => {
					await controller.checkStartup(mockResponse);
				}).rejects.toThrow(timeoutError);

				// Assert
				expect(appHealthService.fetchStartupCheckResponse).toHaveBeenCalled();
				expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
				expect(mockResponse.send).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'starting',
						message: 'Startup check timed out'
					})
				);
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
				const result = await (controller as any).withTimeout(promise, timeout);

				// Assert
				expect(result).toBe('Success');
			});

			xit('rejects with timeout error', async () => {
				// Arrange
				const promise = new Promise((resolve) => setTimeout(resolve, 500, 'Success'));
				const timeout = 250;

				// Act & Assert
				await expect((controller as any).withTimeout(promise, timeout)).rejects.toThrow(
					'Operation timed out after 1000ms'
				);
			});
		});
	});
});