import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import { LogEventSource, LogLevel, UnifiedLogEntry } from '../../libraries/stream-loggable';

import { LogMapper } from './log.mapper';

describe('LogMapper', () => {
  let mapper: LogMapper;
  let logsSubject: Subject<UnifiedLogEntry>;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogMapper],
    }).compile();
    
    mapper = module.get<LogMapper>(LogMapper);
    logsSubject = new Subject<UnifiedLogEntry>();
  });
  
  describe('streamType', () => {
    it('should have the correct stream type identifier', () => {
      expect(mapper.streamType).toBe('log$');
    });
  });
  
  describe('mapToLogEvents', () => {
    it('should pass through log entries with all fields intact', async () => {
      // Map the subject to log events
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestComponent');
      
      // Create a promise that will resolve with the next emitted value
      const logEventPromise = logEvents$.pipe(take(1)).toPromise();
      
      // Mock Date.now to return a fixed value for consistent testing
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Create a complete log entry
      const originalEntry: UnifiedLogEntry = {
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.ERROR,
        message: 'An error occurred',
        context: 'ErrorContext',
        data: { error: 'Details about the error' }
      };
      
      // Emit the log entry
      logsSubject.next(originalEntry);
      
      // Wait for the mapped event
      const logEvent = await logEventPromise;
      
      // Verify the pass-through preserves all fields
      expect(logEvent).toEqual(originalEntry);
      
      // Restore Date
      jest.restoreAllMocks();
    });
    
    it('should set missing source to LOG', async () => {
      // Map the subject to log events
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestComponent');
      
      // Get the next mapped event
      const logEventPromise = logEvents$.pipe(take(1)).toPromise();
      
      // Mock date
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Emit a log entry without source
      const entryWithoutSource = {
        // No source
        timestamp: fixedDate,
        level: LogLevel.INFO,
        message: 'Information message',
        context: 'InfoContext'
      } as UnifiedLogEntry;
      
      logsSubject.next(entryWithoutSource);
      
      // Wait for the mapped event
      const logEvent = await logEventPromise;
      
      // The source should be set to LOG
      expect(logEvent?.source).toBe(LogEventSource.LOG);
      
      // Restore Date
      jest.restoreAllMocks();
    });

    it('should use provided context if log entry has no context', async () => {
      // Map the subject to log events
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'DefaultContext');
      
      // Get the next mapped event
      const logEventPromise = logEvents$.pipe(take(1)).toPromise();
      
      // Mock date
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Emit a log entry without context
      const entryWithoutContext = {
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.INFO,
        message: 'Information message',
        // No context provided
      } as UnifiedLogEntry;
      
      logsSubject.next(entryWithoutContext);
      
      // Wait for the mapped event
      const logEvent = await logEventPromise;
      
      // The context should be the default
      expect(logEvent?.context).toBe('DefaultContext');
      
      // Restore Date
      jest.restoreAllMocks();
    });
    
    it('should set missing timestamp to current date', async () => {
      // Map the subject to log events
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestComponent');
      
      // Get the next mapped event
      const logEventPromise = logEvents$.pipe(take(1)).toPromise();
      
      // Mock date
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Emit a log entry without timestamp
      const entryWithoutTimestamp = {
        source: LogEventSource.LOG,
        // No timestamp
        level: LogLevel.DEBUG,
        message: 'Debug message',
        context: 'DebugContext'
      } as UnifiedLogEntry;
      
      logsSubject.next(entryWithoutTimestamp);
      
      // Wait for the mapped event
      const logEvent = await logEventPromise;
      
      // The timestamp should be set to the mocked date
      expect(logEvent?.timestamp).toEqual(fixedDate);
      
      // Restore Date
      jest.restoreAllMocks();
    });
    
    it('should preserve all log level types', async () => {
      // Map the subject to log events and collect multiple emissions
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestComponent');
      
      // We'll collect entries for all log levels
      const logPromise = logEvents$.pipe(take(6), toArray()).toPromise();
      
      // Mock date
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Emit logs with different levels
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.ERROR,
        message: 'Error log',
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.WARN,
        message: 'Warning log',
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.INFO,
        message: 'Info log',
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.DEBUG,
        message: 'Debug log',
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.VERBOSE,
        message: 'Verbose log',
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.LOG,
        message: 'Regular log',
      });
      
      // Wait for all the mapped events
      const logEvents = await logPromise;
      
      // Verify we got 6 events with the correct log levels
      expect(logEvents?.length).toBe(6);
      expect(logEvents![0].level).toBe(LogLevel.ERROR);
      expect(logEvents![1].level).toBe(LogLevel.WARN);
      expect(logEvents![2].level).toBe(LogLevel.INFO);
      expect(logEvents![3].level).toBe(LogLevel.DEBUG);
      expect(logEvents![4].level).toBe(LogLevel.VERBOSE);
      expect(logEvents![5].level).toBe(LogLevel.LOG);
      
      // Restore Date
      jest.restoreAllMocks();
    });
    
    it('should handle log entries with all possible field combinations', async () => {
      // Map the subject to log events
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestComponent');
      
      // Create a promise that will resolve with multiple emitted values
      const logEventsPromise = logEvents$.pipe(take(4), toArray()).toPromise();
      
      // Mock date
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Emit logs with different field combinations
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.ERROR,
        message: 'Complete entry',
        context: 'CustomContext',
        data: { details: 'Full data' }
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.WARN,
        message: 'No data entry',
        context: 'CustomContext'
        // No data
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.INFO,
        message: 'No context entry',
        // No context
        data: { info: 'Some data' }
      });
      
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.DEBUG,
        message: 'Minimal entry'
        // No context
        // No data
      });
      
      // Wait for all the mapped events
      const logEvents = await logEventsPromise;
      
      // Verify we got 4 events with the correct field combinations
      expect(logEvents?.length).toBe(4);
      
      // Complete entry
      expect(logEvents![0].message).toBe('Complete entry');
      expect(logEvents![0].context).toBe('CustomContext');
      expect(logEvents![0].data).toEqual({ details: 'Full data' });
      
      // No data entry
      expect(logEvents![1].message).toBe('No data entry');
      expect(logEvents![1].context).toBe('CustomContext');
      expect(logEvents![1].data).toBeUndefined();
      
      // No context entry
      expect(logEvents![2].message).toBe('No context entry');
      expect(logEvents![2].context).toBe('TestComponent'); // Default context used
      expect(logEvents![2].data).toEqual({ info: 'Some data' });
      
      // Minimal entry
      expect(logEvents![3].message).toBe('Minimal entry');
      expect(logEvents![3].context).toBe('TestComponent'); // Default context used
      expect(logEvents![3].data).toBeUndefined();
      
      // Restore Date
      jest.restoreAllMocks();
    });
    
    it('should handle empty or null fields gracefully', async () => {
      // Map the subject to log events
      const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestComponent');
      
      // Get the next mapped event
      const logEventPromise = logEvents$.pipe(take(1)).toPromise();
      
      // Mock date
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      // Emit a log entry with empty strings and null values
      logsSubject.next({
        source: LogEventSource.LOG,
        timestamp: fixedDate,
        level: LogLevel.INFO,
        message: '',  // Empty message
        context: '',  // Empty context
        data: null    // Null data
      });
      
      // Wait for the mapped event
      const logEvent = await logEventPromise;     
      
      // Verify the transformation handled these gracefully
      expect(logEvent).toBeDefined();
      expect(logEvent?.message).toBe('');
      expect(logEvent?.context).toBe('TestComponent'); // Default used for empty context
      expect(logEvent?.data).toBeNull();
      
      // Restore Date
      jest.restoreAllMocks();
    });
  });
});