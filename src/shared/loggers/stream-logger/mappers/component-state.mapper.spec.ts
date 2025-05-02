import { Test, TestingModule } from '@nestjs/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import { ComponentState, ComponentStateInfo } from '../../../../libraries/managed-stateful-component/index';
import {LogEventSource, LogLevel } from '../../../../libraries/stream-loggable/index';
import ComponentStateMapper from './component-state.mapper';

describe('ComponentStateMapper', () => {
	let mapper: ComponentStateMapper;
	
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ComponentStateMapper],
		}).compile();
		
		mapper = module.get<ComponentStateMapper>(ComponentStateMapper);
	});
	
	describe('streamType', () => {
		it('should have the correct stream type identifier', () => {
			expect(mapper.streamType).toBe('componentState$');
		});
	});
	
	describe('mapStateToLogLevel', () => {
		it('should map FAILED state to ERROR log level', () => {
			const result = mapper['mapStateToLogLevel'](ComponentState.FAILED);
			expect(result).toBe(LogLevel.ERROR);
		});
		
		it('should map DEGRADED state to WARN log level', () => {
			const result = mapper['mapStateToLogLevel'](ComponentState.DEGRADED);
			expect(result).toBe(LogLevel.WARN);
		});
		
		it('should map INITIALIZING state to INFO log level', () => {
			const result = mapper['mapStateToLogLevel'](ComponentState.INITIALIZING);
			expect(result).toBe(LogLevel.INFO);
		});
		
		it('should map SHUTTING_DOWN state to INFO log level', () => {
			const result = mapper['mapStateToLogLevel'](ComponentState.SHUTTING_DOWN);
			expect(result).toBe(LogLevel.INFO);
		});
		
		it('should map OK state to LOG log level', () => {
			const result = mapper['mapStateToLogLevel'](ComponentState.OK);
			expect(result).toBe(LogLevel.LOG);
		});
		
		it('should map unknown states to LOG log level', () => {
			// @ts-ignore - Testing with a non-existent state
			const result = mapper['mapStateToLogLevel']('UNKNOWN_STATE');
			expect(result).toBe(LogLevel.LOG);
		});
	});
	
	describe('mapToLogEvents', () => {
		let stateSubject: BehaviorSubject<ComponentStateInfo>;
		const now = new Date();
		
		beforeEach(() => {
			stateSubject = new BehaviorSubject<ComponentStateInfo>({
				name: 'TestComponent',
				state: ComponentState.INITIALIZING,
				reason: 'Starting up',
				updatedOn: now
			});
		});
		
		it('should transform state events to unified log entries', async () => {
			// Map the subject to log events
			const logEvents$ = mapper.mapToLogEvents(stateSubject.asObservable(), 'TestComponent');
			
			// Create a promise that will resolve with the next emitted value
			const logEventPromise = firstValueFrom(logEvents$.pipe(take(1)));
			
			// Wait for the mapped event
			const logEvent = await logEventPromise;
			
			// Verify the transformation
			expect(logEvent).toEqual({
				source: LogEventSource.STATE,
				timestamp: now,
				level: LogLevel.INFO, // INITIALIZING maps to INFO
				message: `State changed to ${ComponentState.INITIALIZING}: Starting up`,
				context: 'TestComponent',
				data: { // Original state data
					name: 'TestComponent',
					state: ComponentState.INITIALIZING,
					reason: 'Starting up',
					updatedOn: now
				}
			});
		});
		
		it('should use state.name as context if available', async () => {
			// Update the subject with a state that includes a name
			stateSubject.next({
				state: ComponentState.OK,
				reason: 'All good',
				name: 'NamedComponent',
				updatedOn: now
			});
			
			// Map the subject to log events
			const logEvents$ = mapper.mapToLogEvents(stateSubject.asObservable(), 'DefaultContext');
			
			// Get the next mapped event
			const logEvent = await logEvents$.pipe(take(1)).toPromise();
			
			// The context should be the name from the state, not the default
			expect(logEvent?.context).toBe('NamedComponent');
		});
		
		it('should use the provided context if state.name is not available', async () => {
			// Update the subject with a state that doesn't include a name
			stateSubject.next({
				name: undefined as any,
				state: ComponentState.OK,
				reason: 'All good',
				updatedOn: now
			});
			
			// Map the subject to log events
			const logEvents$ = mapper.mapToLogEvents(stateSubject.asObservable(), 'DefaultContext');
			
			// Get the next mapped event
			const logEvent = await logEvents$.pipe(take(1)).toPromise();
			
			// The context should be the default
			expect(logEvent?.context).toBe('DefaultContext');
		});
		
		it('should use current date if updatedOn is not provided', async () => {
			// Mock Date.now to return a fixed value
			const fixedDate = new Date('2023-01-01T12:00:00Z');
			jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
			
			// Update the subject with a state that doesn't include updatedOn
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.OK,
				reason: 'All good'
				// No updatedOn
			} as any);
			
			// Map the subject to log events
			const logEvents$ = mapper.mapToLogEvents(stateSubject.asObservable(), 'TestComponent');
			
			// Get the next mapped event
			const logEvent = await logEvents$.pipe(take(1)).toPromise();
			
			// The timestamp should be the fixed date
			expect(logEvent?.timestamp).toBe(fixedDate);
			
			// Restore Date
			jest.restoreAllMocks();
		});
		
		it('should handle multiple state changes correctly', async () => {
			// Map the subject to log events and collect multiple emissions
			const logEvents$ = mapper.mapToLogEvents(stateSubject.asObservable(), 'TestComponent');
			
			// Create a promise that will resolve with the next 3 emitted values
			const logEventsPromise = logEvents$.pipe(take(3), toArray()).toPromise();
			
			// Emit multiple state changes
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.OK,
				reason: 'Initialized successfully',
				updatedOn: new Date()
			});
			
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.DEGRADED,
				reason: 'Performance issue detected',
				updatedOn: new Date()
			});
			
			// Wait for all the mapped events
			const logEvents = await logEventsPromise;
			
			// Verify we got 3 events with the correct mappings
			expect(logEvents?.length).toBe(3);
			
			// First event (from beforeEach)
			expect(logEvents![0].message).toBe(`State changed to ${ComponentState.INITIALIZING}: Starting up`);
			expect(logEvents![0].level).toBe(LogLevel.INFO);
			
			// Second event
			expect(logEvents![1].message).toBe(`State changed to ${ComponentState.OK}: Initialized successfully`);
			expect(logEvents![1].level).toBe(LogLevel.LOG);
			
			// Third event
			expect(logEvents![2].message).toBe(`State changed to ${ComponentState.DEGRADED}: Performance issue detected`);
			expect(logEvents![2].level).toBe(LogLevel.WARN);
		});
		
		it('should map different component states to appropriate log levels', async () => {
			// Map the subject to log events
			const logEvents$ = mapper.mapToLogEvents(stateSubject.asObservable(), 'TestComponent');
			
			// We'll collect the log levels for different states
			const levels: LogLevel[] = [];
			
			// Subscribe to capture all events
			const subscription = logEvents$.subscribe(event => {
				levels.push(event.level);
			});
			
			// Emit various states
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.OK,
				reason: 'All good',
				updatedOn: new Date()
			});
			
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.DEGRADED,
				reason: 'Slow response',
				updatedOn: new Date()
			});
			
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.FAILED,
				reason: 'Fatal error',
				updatedOn: new Date()
			});
			
			stateSubject.next({
				name: 'TestComponent',
				state: ComponentState.SHUTTING_DOWN,
				reason: 'System shutdown',
				updatedOn: new Date()
			});
			
			// Clean up
			subscription.unsubscribe();
			
			// We should have 5 levels (initial INITIALIZING + 4 we sent)
			expect(levels.length).toBe(5);
			
			// Check the correct mapping (starting with initial INITIALIZING from beforeEach)
			expect(levels[0]).toBe(LogLevel.INFO);	// INITIALIZING
			expect(levels[1]).toBe(LogLevel.LOG);	 // OK
			expect(levels[2]).toBe(LogLevel.WARN);	// DEGRADED
			expect(levels[3]).toBe(LogLevel.ERROR); // FAILED
			expect(levels[4]).toBe(LogLevel.INFO);	// SHUTTING_DOWN
		});
	});
});