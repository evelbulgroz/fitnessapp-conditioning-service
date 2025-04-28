import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { LogEntry as RepoLogEntry, LogLevel } from '@evelbulgroz/ddd-base';

import { RepoLogMapper } from './repo-log.mapper';
import LogEventSource from '../models/log-event-source.model';

describe('RepoLogMapper', () => {
	let mapper: RepoLogMapper;
	let logsSubject: Subject<RepoLogEntry>;
	
	beforeEach(async () => {
			const module: TestingModule = await Test.createTestingModule({
					providers: [RepoLogMapper],
			}).compile();
			
			mapper = module.get<RepoLogMapper>(RepoLogMapper);
			logsSubject = new Subject<RepoLogEntry>();
	});
	
	describe('streamType', () => {
			it('should have the correct stream type identifier', () => {
					expect(mapper.streamType).toBe('repoLog$');
			});
	});
	
	describe('mapToLogEvents', () => {
			it('should transform log entries to unified log entries', async () => {
					// Map the subject to log events
					const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestRepo');
					
					// Create a promise that will resolve with the next emitted value
					const logEventPromise = logEvents$.pipe(take(1)).toPromise();
					
					// Mock Date.now to return a fixed value for consistent testing
					const fixedDate = new Date('2023-01-01T12:00:00Z');
					jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
					
					// Emit a log entry
					logsSubject.next({
							sequence: 1,
							timestamp: fixedDate,
							level: LogLevel.ERROR,
							message: 'Database connection failed',
							context: 'DbConnection',
							data: { error: 'Connection timeout' }
					});
					
					// Wait for the mapped event
					const logEvent = await logEventPromise;
					
					// Verify the transformation
					expect(logEvent).toEqual({
							source: LogEventSource.LOG,
							timestamp: fixedDate,
							level: LogLevel.ERROR,
							message: 'Database connection failed',
							context: 'DbConnection',
							data: { error: 'Connection timeout' }
					});
					
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
					logsSubject.next({
							sequence: 1,
							timestamp: fixedDate,
							level: LogLevel.INFO,
							message: 'Operation completed',
							// No context provided
							data: { status: 'success' }
					});
					
					// Wait for the mapped event
					const logEvent = await logEventPromise;
					
					// The context should be the default
					expect(logEvent?.context).toBe('DefaultContext');
					
					// Restore Date
					jest.restoreAllMocks();
			});
			
			it('should preserve all log level types', async () => {
					// Map the subject to log events and collect multiple emissions
					const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestRepo');
					
					// We'll collect entries for all log levels
					const logPromise = logEvents$.pipe(take(6), toArray()).toPromise();
					
					// Mock date
					const fixedDate = new Date('2023-01-01T12:00:00Z');
					jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
					
					// Emit logs with different levels
					logsSubject.next({
							sequence: 1,
							timestamp: fixedDate,
							level: LogLevel.ERROR,
							message: 'Error log',
					});
					
					logsSubject.next({
							sequence: 2,
							timestamp: fixedDate,
							level: LogLevel.WARN,
							message: 'Warning log',
					});
					
					logsSubject.next({
							sequence: 3,
							timestamp: fixedDate,
							level: LogLevel.INFO,
							message: 'Info log',
					});
					
					logsSubject.next({
							sequence: 4,
							timestamp: fixedDate,
							level: LogLevel.DEBUG,
							message: 'Debug log',
					});
					
					logsSubject.next({
							sequence: 5,
							timestamp: fixedDate,
							level: LogLevel.VERBOSE,
							message: 'Verbose log',
					});
					
					logsSubject.next({
							sequence: 6,
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
					const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestRepo');
					
					// Create a promise that will resolve with multiple emitted values
					const logEventsPromise = logEvents$.pipe(take(4), toArray()).toPromise();
					
					// Mock date
					const fixedDate = new Date('2023-01-01T12:00:00Z');
					jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
					const timestamp = fixedDate;
					
					// Emit logs with different field combinations
					logsSubject.next({
							sequence: 1,
							timestamp: timestamp,
							level: LogLevel.ERROR,
							message: 'Complete entry',
							context: 'CustomContext',
							data: { details: 'Full data' }
					});
					
					logsSubject.next({
							sequence: 2,
							timestamp: timestamp,
							level: LogLevel.WARN,
							message: 'No data entry',
							context: 'CustomContext'
							// No data
					});
					
					logsSubject.next({
							sequence: 3,
							timestamp: timestamp,
							level: LogLevel.INFO,
							message: 'No context entry',
							// No context
							data: { info: 'Some data' }
					});
					
					logsSubject.next({
							sequence: 4,
							timestamp: timestamp,
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
					expect(logEvents![2].context).toBe('TestRepo'); // Default context used
					expect(logEvents![2].data).toEqual({ info: 'Some data' });
					
					// Minimal entry
					expect(logEvents![3].message).toBe('Minimal entry');
					expect(logEvents![3].context).toBe('TestRepo'); // Default context used
					expect(logEvents![3].data).toBeUndefined();
					
					// Restore Date
					jest.restoreAllMocks();
			});
			
			it('should create a new timestamp for each mapped event', async () => {
					// Map the subject to log events
					const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestRepo');
					
					// We'll mock Date three times with different values
					const dates = [
							new Date('2023-01-01T12:00:00Z'),
							new Date('2023-01-01T12:00:01Z'),
							new Date('2023-01-01T12:00:02Z')
					];
					
					let dateIndex = 0;
					jest.spyOn(global, 'Date').mockImplementation(() => {
							return dates[dateIndex++] as any;
					});
					
					// Create a promise that will resolve with multiple emitted values
					const logEventsPromise = logEvents$.pipe(take(3), toArray()).toPromise();
					
					// Emit three log entries
					for (let i = 0; i < 3; i++) {
							logsSubject.next({
									sequence: i + 1,
									timestamp: dates[i],
									level: LogLevel.LOG,
									message: `Log entry ${i + 1}`
							});
					}
					
					// Wait for all the mapped events
					const logEvents = await logEventsPromise;

					expect(logEvents?.length).toBe(3);
					
					// Verify each has a different timestamp
					expect(logEvents![0].timestamp).toBe(dates[0]);
					expect(logEvents![1].timestamp).toBe(dates[1]);
					expect(logEvents![2].timestamp).toBe(dates[2]);
					
					// Restore Date
					jest.restoreAllMocks();
			});
			
			it('should handle empty or null fields gracefully', async () => {
					// Map the subject to log events
					const logEvents$ = mapper.mapToLogEvents(logsSubject.asObservable(), 'TestRepo');
					
					// Get the next mapped event
					const logEventPromise = logEvents$.pipe(take(1)).toPromise();
					
					// Mock date
					const fixedDate = new Date('2023-01-01T12:00:00Z');
					jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
					
					// Emit a log entry with empty strings and null values
					logsSubject.next({
							sequence: 1,
							timestamp: fixedDate,
							level: LogLevel.INFO,
							message: '',	// Empty message
							context: '',	// Empty context
							data: null		// Null data
					});
					
					// Wait for the mapped event
					const logEvent = await logEventPromise;					
					
					// Verify the transformation handled these gracefully
					expect(logEvent).toBeDefined();
					expect(logEvent?.message).toBe('');
					expect(logEvent?.context).toBe('TestRepo'); // Default used for empty context
					expect(logEvent?.data).toBeNull();
					
					// Restore Date
					jest.restoreAllMocks();
			});
	});
});