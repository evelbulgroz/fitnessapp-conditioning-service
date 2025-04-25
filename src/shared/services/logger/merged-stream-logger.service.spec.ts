import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { Logger } from '@evelbulgroz/logger';

import { MergedStreamLogger } from './merged-stream-logger.service';
import LogLevel from './models/log-level.enum';
import LogEventSource from './models/log-event-source.model';
import UnifiedLogEntry from './models/unified-log-event.model';
import StreamMapper from './models/stream-mapper.model';

// Mock log entry type for testing
interface MockLogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
}

// Mock state type for testing
interface MockState {
  state: string;
  reason: string;
  name?: string;
}

// Mock metric type for testing
interface MockMetric {
  name: string;
  value: number;
  timestamp: Date;
}

// Mock mappers for testing
class MockLogMapper implements StreamMapper<MockLogEntry> {
  public readonly streamType = 'logs$';
  
  public mapToLogEvents(source$, context?) {
    return source$.pipe(
      map((log: MockLogEntry): UnifiedLogEntry => ({
        source: LogEventSource.LOG,
        timestamp: new Date(),
        level: log.level,
        message: log.message,
        context: log.context || context,
        data: log.data
      }))
    );
  }
}

class MockStateMapper implements StreamMapper<MockState> {
  public readonly streamType = 'state$';
  
  public mapToLogEvents(source$, context?) {
    return source$.pipe(
      map((state: MockState): UnifiedLogEntry => ({
        source: LogEventSource.STATE,
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: `State changed to ${state.state}: ${state.reason}`,
        context: state.name || context,
        data: state
      }))
    );
  }
}

class MockMetricMapper implements StreamMapper<MockMetric> {
  public readonly streamType = 'metrics$';
  
  public mapToLogEvents(source$, context?) {
    return source$.pipe(
      map((metric: MockMetric): UnifiedLogEntry => ({
        source: LogEventSource.CUSTOM,
        timestamp: metric.timestamp,
        level: LogLevel.LOG,
        message: `Metric: ${metric.name} = ${metric.value}`,
        context: context,
        data: metric
      }))
    );
  }
}

// Import map operator that might be missing from the imports
import { map } from 'rxjs/operators';

describe('MergedStreamLogger', () => {
  let logger: MergedStreamLogger;
  let mockLogger: jest.Mocked<Logger>;
  let logMapper: MockLogMapper;
  let stateMapper: MockStateMapper;
  let metricMapper: MockMetricMapper;
  
  beforeEach(async () => {
    // Create mock logger with spied methods
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
    
    // Create mappers
    logMapper = new MockLogMapper();
    stateMapper = new MockStateMapper();
    metricMapper = new MockMetricMapper();
    
    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: 'STREAM_MAPPERS',
          useValue: [logMapper, stateMapper],
        },
        MergedStreamLogger,
      ],
    }).compile();
    
    logger = module.get<MergedStreamLogger>(MergedStreamLogger);
  });
  
  afterEach(() => {
    // Clean up subscriptions
    logger.unsubscribeAll();
    jest.clearAllMocks();
  });
  
  describe('Constructor and initialization', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });
    
    it('should register mappers from injection token', () => {
      // The mappers should be registered during construction
      // We can test this indirectly by subscribing to streams
      const logs$ = new Subject<MockLogEntry>();
      const state$ = new Subject<MockState>();
      
      logger.subscribeToStreams({ logs$, state$ }, 'TestContext');
      
      logs$.next({ level: LogLevel.LOG, message: 'Test log' });
      state$.next({ state: 'OK', reason: 'All good' });
      
      expect(mockLogger.log).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('registerMapper', () => {
    it('should register a new mapper', () => {
      // Create a new stream
      const metrics$ = new Subject<MockMetric>();
      
      // Try to subscribe without a mapper first - should log a warning
      logger.subscribeToStreams({ metrics$ }, 'TestContext');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No mapper registered for stream type "metrics$"'),
        expect.any(String)
      );
      
      // Now register the mapper
      logger.registerMapper(metricMapper);
      
      // Try again
      logger.subscribeToStreams({ metrics$ }, 'TestContext');
      
      // Send a metric
      metrics$.next({ 
        name: 'test-metric', 
        value: 42, 
        timestamp: new Date() 
      });
      
      // Should be logged now
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Metric: test-metric = 42'),
        'TestContext'
      );
    });
  });
  
  describe('subscribeToStreams', () => {
    let logs$: Subject<MockLogEntry>;
    let state$: Subject<MockState>;
    
    beforeEach(() => {
      logs$ = new Subject<MockLogEntry>();
      state$ = new Subject<MockState>();
    });
    
    it('should subscribe to a single stream', () => {
      // Subscribe to just logs$
      logger.subscribeToStreams({ logs$ }, 'TestContext');
      
      // Send a log
      logs$.next({ 
        level: LogLevel.ERROR, 
        message: 'Test error', 
        data: { error: 'Something went wrong' } 
      });
      
      // Should call the error method
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Test error',
        { error: 'Something went wrong' },
        'TestContext'
      );
    });
    
    it('should subscribe to multiple streams', () => {
      // Subscribe to both logs$ and state$
      logger.subscribeToStreams({ logs$, state$ }, 'TestContext');
      
      // Send a log and a state update
      logs$.next({ level: LogLevel.LOG, message: 'Test log' });
      state$.next({ state: 'DEGRADED', reason: 'Service slow' });
      
      // Should have logged both
      expect(mockLogger.log).toHaveBeenCalledWith('Test log', 'TestContext');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('State changed to DEGRADED: Service slow'),
        'TestContext'
      );
    });
    
    it('should use the provided context for all streams', () => {
      logger.subscribeToStreams({ logs$, state$ }, 'CustomContext');
      
      logs$.next({ level: LogLevel.LOG, message: 'Test log' });
      
      expect(mockLogger.log).toHaveBeenCalledWith('Test log', 'CustomContext');
    });
    
    it('should respect context in log entry if provided', () => {
      logger.subscribeToStreams({ logs$ }, 'DefaultContext');
      
      logs$.next({ 
        level: LogLevel.LOG, 
        message: 'Test log', 
        context: 'OverrideContext' 
      });
      
      expect(mockLogger.log).toHaveBeenCalledWith('Test log', 'OverrideContext');
    });
    
    it('should handle empty streams object gracefully', () => {
      // This shouldn't throw or create any subscriptions
      logger.subscribeToStreams({}, 'TestContext');
      
      // We can verify no subscriptions were created by checking if unsubscribeComponent returns false
      expect(logger.unsubscribeComponent('TestContext')).toBe(false);
    });
    
    it('should handle null/undefined streams gracefully', () => {
      // @ts-ignore - Testing runtime behavior
      logger.subscribeToStreams({ logs$: null, state$: undefined }, 'TestContext');
      
      // The method should complete without error, but no subscriptions should be created
      expect(logger.unsubscribeComponent('TestContext')).toBe(false);
    });
  });
  
  describe('unsubscribeComponent', () => {
    let logs$: Subject<MockLogEntry>;
    let state$: Subject<MockState>;
    
    beforeEach(() => {
      logs$ = new Subject<MockLogEntry>();
      state$ = new Subject<MockState>();
    });
    
    it('should unsubscribe all streams for a component', () => {
      // Subscribe with a specific key
      logger.subscribeToStreams({ logs$, state$ }, 'TestContext', 'testKey');
      
      // Verify subscriptions are working
      logs$.next({ level: LogLevel.LOG, message: 'Test log' });
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
      
      // Unsubscribe
      const result = logger.unsubscribeComponent('testKey');
      
      // Should return true
      expect(result).toBe(true);
      
      // Sending more events should not trigger logging
      logs$.next({ level: LogLevel.LOG, message: 'After unsubscribe' });
      state$.next({ state: 'OK', reason: 'After unsubscribe' });
      
      // Log count should still be 1
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
    });
    
    it('should return false when unsubscribing a component that has no subscriptions', () => {
      const result = logger.unsubscribeComponent('nonExistentKey');
      expect(result).toBe(false);
    });
    
    it('should allow multiple components to subscribe and unsubscribe independently', () => {
      // Subscribe component A
      const logsA$ = new Subject<MockLogEntry>();
      logger.subscribeToStreams({ logs$: logsA$ }, 'ComponentA', 'keyA');
      
      // Subscribe component B
      const logsB$ = new Subject<MockLogEntry>();
      logger.subscribeToStreams({ logs$: logsB$ }, 'ComponentB', 'keyB');
      
      // Both should work
      logsA$.next({ level: LogLevel.LOG, message: 'Log from A' });
      logsB$.next({ level: LogLevel.LOG, message: 'Log from B' });
      
      expect(mockLogger.log).toHaveBeenCalledTimes(2);
      
      // Unsubscribe A
      logger.unsubscribeComponent('keyA');
      
      // A should no longer work, but B should
      logsA$.next({ level: LogLevel.LOG, message: 'Log from A again' });
      logsB$.next({ level: LogLevel.LOG, message: 'Log from B again' });
      
      expect(mockLogger.log).toHaveBeenCalledTimes(3);
      expect(mockLogger.log).toHaveBeenLastCalledWith('Log from B again', 'ComponentB');
    });
  });
  
  describe('unsubscribeAll', () => {
    it('should unsubscribe all components', () => {
      // Set up multiple components
      const logsA$ = new Subject<MockLogEntry>();
      const logsB$ = new Subject<MockLogEntry>();
      const logsC$ = new Subject<MockLogEntry>();
      
      logger.subscribeToStreams({ logs$: logsA$ }, 'ComponentA', 'keyA');
      logger.subscribeToStreams({ logs$: logsB$ }, 'ComponentB', 'keyB');
      logger.subscribeToStreams({ logs$: logsC$ }, 'ComponentC', 'keyC');
      
      // Verify they work
      logsA$.next({ level: LogLevel.LOG, message: 'Log from A' });
      logsB$.next({ level: LogLevel.LOG, message: 'Log from B' });
      logsC$.next({ level: LogLevel.LOG, message: 'Log from C' });
      
      expect(mockLogger.log).toHaveBeenCalledTimes(3);
      
      // Unsubscribe all
      logger.unsubscribeAll();
      
      // None should work
      logsA$.next({ level: LogLevel.LOG, message: 'Log from A again' });
      logsB$.next({ level: LogLevel.LOG, message: 'Log from B again' });
      logsC$.next({ level: LogLevel.LOG, message: 'Log from C again' });
      
      expect(mockLogger.log).toHaveBeenCalledTimes(3); // Still just 3
      
      // Should no longer have subscriptions for any component
      expect(logger.unsubscribeComponent('keyA')).toBe(false);
      expect(logger.unsubscribeComponent('keyB')).toBe(false);
      expect(logger.unsubscribeComponent('keyC')).toBe(false);
    });
  });
  
  describe('log level routing', () => {
    let logs$: Subject<MockLogEntry>;
    
    beforeEach(() => {
      logs$ = new Subject<MockLogEntry>();
      logger.subscribeToStreams({ logs$ }, 'TestContext');
    });
    
    it('should route ERROR level to logger.error', () => {
      logs$.next({ 
        level: LogLevel.ERROR, 
        message: 'Error message', 
        data: { error: 'test' } 
      });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error message', 
        { error: 'test' }, 
        'TestContext'
      );
    });
    
    it('should route WARN level to logger.warn', () => {
      logs$.next({ level: LogLevel.WARN, message: 'Warning message' });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Warning message', 
        'TestContext'
      );
    });
    
    it('should route INFO level to logger.info', () => {
      logs$.next({ level: LogLevel.INFO, message: 'Info message' });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Info message', 
        'TestContext'
      );
    });
    
    it('should route DEBUG level to logger.debug', () => {
      logs$.next({ level: LogLevel.DEBUG, message: 'Debug message' });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Debug message', 
        'TestContext'
      );
    });
    
    it('should route VERBOSE level to logger.verbose', () => {
      logs$.next({ 
        level: LogLevel.VERBOSE, 
        message: 'Verbose message', 
        data: { detail: 'Extra info' } 
      });
      
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('Verbose message'),
        'TestContext'
      );
      // The call should include JSON-stringified data
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('{"detail":"Extra info"}'),
        'TestContext'
      );
    });
    
    it('should route LOG level to logger.log', () => {
      logs$.next({ level: LogLevel.LOG, message: 'Log message' });
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Log message', 
        'TestContext'
      );
    });
    
    it('should default to logger.log for unknown levels', () => {
      // @ts-ignore - Testing runtime behavior
      logs$.next({ level: 999, message: 'Unknown level' });
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Unknown level', 
        'TestContext'
      );
    });
  });
  
  describe('Integration scenarios', () => {
    it('should handle high frequency log events', () => {
      const logs$ = new Subject<MockLogEntry>();
      logger.subscribeToStreams({ logs$ }, 'HighFrequencyTest');
      
      // Send 100 log events rapidly
      for (let i = 0; i < 100; i++) {
        logs$.next({ 
          level: LogLevel.LOG, 
          message: `Log message ${i}` 
        });
      }
      
      expect(mockLogger.log).toHaveBeenCalledTimes(100);
    });
    
    it('should continue processing after one stream errors', () => {
      const logs$ = new Subject<MockLogEntry>();
      const state$ = new Subject<MockState>();
      
      // Override the state mapper to simulate an error
      const originalMapToLogEvents = stateMapper.mapToLogEvents;
      stateMapper.mapToLogEvents = jest.fn().mockImplementation((source$, context) => {
        return source$.pipe(
          map((state: MockState) => {
            if (state.state === 'ERROR_TRIGGER') {
              throw new Error('Mapper error');
            }
            return {
              source: LogEventSource.STATE,
              timestamp: new Date(),
              level: LogLevel.INFO,
              message: `State changed to ${state.state}: ${state.reason}`,
              context: state.name || context,
              data: state
            } as UnifiedLogEntry;
          })
        );
      });
      
      // Subscribe to both
      logger.subscribeToStreams({ logs$, state$ }, 'ErrorTest');
      
      // Send a normal log
      logs$.next({ level: LogLevel.LOG, message: 'Before error' });
      
      // Send a state that will cause an error in the mapper
      try {
        state$.next({ state: 'ERROR_TRIGGER', reason: 'Should cause error' });
      } catch (e) {
        // Expected
      }
      
      // Send another normal log
      logs$.next({ level: LogLevel.LOG, message: 'After error' });
      
      // The system should have logged the messages before and after
      expect(mockLogger.log).toHaveBeenCalledWith('Before error', 'ErrorTest');
      expect(mockLogger.log).toHaveBeenCalledWith('After error', 'ErrorTest');
      
      // Restore original method
      stateMapper.mapToLogEvents = originalMapToLogEvents;
    });
    
    it('should handle completion of source streams', () => {
      const logs$ = new Subject<MockLogEntry>();
      const state$ = new Subject<MockState>();
      
      logger.subscribeToStreams({ logs$, state$ }, 'CompletionTest');
      
      // Send initial messages
      logs$.next({ level: LogLevel.LOG, message: 'Initial log' });
      state$.next({ state: 'OK', reason: 'Initial state' });
      
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      
      // Complete logs$ but not state$
      logs$.complete();
      
      // State$ should still work
      state$.next({ state: 'DEGRADED', reason: 'After log completion' });
      
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      
      // Complete state$ too
      state$.complete();
      
      // Both streams are now completed, but the subscription should still exist
      // We can verify this by checking unsubscribeComponent still returns true
      expect(logger.unsubscribeComponent('CompletionTest')).toBe(true);
    });
  });
});