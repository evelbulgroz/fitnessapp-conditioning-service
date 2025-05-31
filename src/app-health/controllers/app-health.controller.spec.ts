import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Response } from 'express';

import AppDomainStateManager from '../../app-domain-state-manager';
import AppHealthController from './app-health.controller';
import AppHealthService from '../services/health/app-health.service';
import ModuleStateHealthIndicator from '../health-indicators/module-state-health-indicator';
import { ComponentState } from '../../libraries/managed-stateful-component';

describe('AppHealthController', () => {
  let controller: AppHealthController;
  let appDomainStateManager: jest.Mocked<AppDomainStateManager>;
  let appHealthService: jest.Mocked<AppHealthService>;
  let disk: jest.Mocked<DiskHealthIndicator>;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let memory: jest.Mocked<MemoryHealthIndicator>;
  let moduleStateHealthIndicator: jest.Mocked<ModuleStateHealthIndicator>;
  let response: jest.Mocked<Response>;

  beforeEach(async () => {
    // Create mock implementations
    appDomainStateManager = {
      getState: jest.fn(),
    } as any;

    appHealthService = {} as any;

    disk = {
      checkStorage: jest.fn(),
    } as any;

    healthCheckService = {
      check: jest.fn(),
    } as any;

    memory = {
      checkHeap: jest.fn(),
      checkRSS: jest.fn(),
    } as any;

    moduleStateHealthIndicator = {
      isHealthy: jest.fn(),
    } as any;

    response = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;

    // Create the controller with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppHealthController],
      providers: [
        { provide: AppDomainStateManager, useValue: appDomainStateManager },
        { provide: AppHealthService, useValue: appHealthService },
        { provide: DiskHealthIndicator, useValue: disk },
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: MemoryHealthIndicator, useValue: memory },
        { provide: ModuleStateHealthIndicator, useValue: moduleStateHealthIndicator },
      ],
    }).compile();

    controller = module.get<AppHealthController>(AppHealthController);

    // Mock Date.now to return a consistent value
    jest.spyOn(Date, 'now').mockReturnValue(1622505600000); // 2021-06-01
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      return 1 as any; // just return a numeric ID
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('healthz endpoint', () => {
    describe('checkHealth method', () => {
      test('returns 200 OK when app state is healthy', async () => {
        // Arrange
        const now = new Date();
        const stateInfo = {
          state: ComponentState.OK,
          updatedOn: now,
        };
        appDomainStateManager.getState.mockResolvedValue(stateInfo);

        // Act
        await controller.checkHealth(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'up',
          info: expect.objectContaining({
            app: expect.objectContaining({
              status: 'up',
              state: stateInfo
            })
          })
        }));
      });

      test('returns 503 Service Unavailable when app state is degraded', async () => {
        // Arrange
        const stateInfo = {
          state: ComponentState.DEGRADED,
          reason: 'Some dependency is not available',
        };
        appDomainStateManager.getState.mockResolvedValue(stateInfo);

        // Act
        await controller.checkHealth(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'down',
          info: expect.objectContaining({
            app: expect.objectContaining({
              status: 'down',
              state: stateInfo
            })
          })
        }));
      });

      test('returns 503 Service Unavailable when app state is not available', async () => {
        // Arrange
        appDomainStateManager.getState.mockResolvedValue(null);

        // Act
        await controller.checkHealth(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'down',
          error: expect.anything()
        }));
      });

      test('returns 503 Service Unavailable when operation times out', async () => {
        // Arrange
        // Mock a delayed response that will trigger timeout
        appDomainStateManager.getState.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(null), 3000))
        );

        // Act
        await controller.checkHealth(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'down',
          error: expect.stringContaining('timed out')
        }));
      });

      test('returns 503 Service Unavailable when domain manager throws error', async () => {
        // Arrange
        appDomainStateManager.getState.mockRejectedValue(new Error('Connection error'));

        // Act
        await controller.checkHealth(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'down',
          error: 'Connection error'
        }));
      });
    });
  });

  describe('livenessz endpoint', () => {
    describe('checkLiveness method', () => {
      test('returns status up', () => {
        // Arrange - no arrangement needed for this simple method

        // Act
        const result = controller.checkLiveness();

        // Assert
        expect(result).toEqual({ status: 'up' });
      });
    });
  });

  describe('readinessz endpoint', () => {
    describe('isReady method', () => {
      test('returns 200 OK when all checks pass', async () => {
        // Arrange
        healthCheckService.check.mockResolvedValue({
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
        });

        // Act
        await controller.isReady(response);

        // Assert
        expect(healthCheckService.check).toHaveBeenCalled();
        expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'up',
          info: expect.any(Object),
          details: expect.any(Object),
          timestamp: expect.any(String)
        }));
      });

      test('returns 503 Service Unavailable when any check fails', async () => {
        // Arrange
        const checkError = new Error('Health check failed');
        checkError.response = {
          status: 'error',
          error: {
            'memory_heap': {
              status: 'down',
              message: 'Memory usage too high'
            }
          },
          info: {},
          details: {}
        };
        
        healthCheckService.check.mockRejectedValue(checkError);

        // Act
        await controller.isReady(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'down',
          error: expect.objectContaining({
            'memory_heap': expect.any(Object)
          })
        }));
      });

      test('returns 503 Service Unavailable when operation times out', async () => {
        // Arrange
        healthCheckService.check.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(null), 6000))
        );

        // Act
        await controller.isReady(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'down',
          error: expect.objectContaining({
            message: expect.stringContaining('timed out')
          })
        }));
      });

      test('correctly maps HealthCheckResult to ReadinessCheckResponse', async () => {
        // Arrange
        const healthCheckResult = {
          status: 'ok',
          info: {
            'module-state': { status: 'up', someExtraData: 'value' }
          },
          error: {},
          details: {
            'module-state': { status: 'up', someDetails: 'details' }
          }
        };

        healthCheckService.check.mockResolvedValue(healthCheckResult);

        // Act
        await controller.isReady(response);

        // Assert
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'up',
          info: {
            'module-state': { status: 'up' } // Extra data is removed
          },
          error: {},
          details: healthCheckResult.details,
          timestamp: expect.any(String)
        }));
      });
    });
  });

  describe('startupz endpoint', () => {
    describe('checkStartup method', () => {
      test('returns 200 OK when app state is OK', async () => {
        // Arrange
        const stateInfo = {
          state: ComponentState.OK,
          updatedOn: new Date()
        };
        appDomainStateManager.getState.mockResolvedValue(stateInfo);

        // Act
        await controller.checkStartup(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'started',
          timestamp: expect.any(String)
        }));
      });

      test('returns 200 OK when app state is DEGRADED (app still considered started)', async () => {
        // Arrange
        const stateInfo = {
          state: ComponentState.DEGRADED,
          updatedOn: new Date()
        };
        appDomainStateManager.getState.mockResolvedValue(stateInfo);

        // Act
        await controller.checkStartup(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'started',
          timestamp: expect.any(String)
        }));
      });

      test('returns 503 Service Unavailable when app state is ERROR', async () => {
        // Arrange
        const stateInfo = {
          state: ComponentState.ERROR,
          updatedOn: new Date()
        };
        appDomainStateManager.getState.mockResolvedValue(stateInfo);

        // Act
        await controller.checkStartup(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'starting',
          timestamp: expect.any(String)
        }));
      });

      test('returns 503 Service Unavailable when app state is STARTING', async () => {
        // Arrange
        const stateInfo = {
          state: ComponentState.STARTING,
          updatedOn: new Date()
        };
        appDomainStateManager.getState.mockResolvedValue(stateInfo);

        // Act
        await controller.checkStartup(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'starting',
          timestamp: expect.any(String)
        }));
      });

      test('returns 503 Service Unavailable when app state is null', async () => {
        // Arrange
        appDomainStateManager.getState.mockResolvedValue(null);

        // Act
        await controller.checkStartup(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'starting',
          message: expect.stringContaining('not available')
        }));
      });

      test('returns 503 Service Unavailable when operation times out', async () => {
        // Arrange
        appDomainStateManager.getState.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(null), 3000))
        );

        // Act
        await controller.checkStartup(response);

        // Assert
        expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
        expect(response.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'starting',
          message: expect.stringContaining('timed out')
        }));
      });
    });
  });

  describe('Helper methods', () => {
    describe('withTimeout', () => {
      test('resolves with promise result when completed before timeout', async () => {
        // Arrange
        const promise = Promise.resolve('success');
        
        // Act
        const result = await controller['withTimeout'](promise, 1000);
        
        // Assert
        expect(result).toBe('success');
      });

      test('rejects with timeout error when promise takes too long', async () => {
        // Arrange
        const slowPromise = new Promise(resolve => setTimeout(() => resolve('too late'), 2000));
        
        // Act & Assert
        await expect(controller['withTimeout'](slowPromise, 1000)).rejects.toThrow('Operation timed out');
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
        const result = controller['mapHealthCheckResultToReadinessResponse'](healthCheck, now);

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
        const result = controller['mapHealthCheckResultToReadinessResponse'](healthCheck, now);

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
});