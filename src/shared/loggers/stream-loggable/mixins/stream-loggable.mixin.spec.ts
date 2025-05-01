import { firstValueFrom, take, toArray } from 'rxjs';

import StreamLoggableMixin from './stream-loggable.mixin';
import LogLevel from '../models/log-level.enum';

describe('StreamLoggableMixin', () => {
	// Base class to apply the mixin to
	class TestBase {
		public baseMethod(): string {
			return 'base method called';
		}
	}

	// Class using the mixin
	class LoggableTest extends StreamLoggableMixin(TestBase) {
		public testLogging(): void {
			this.log(LogLevel.INFO, 'Test logging method');
		}
		
		public customBaseMethod(): string {
			return `Extended ${this.baseMethod()}`;
		}
	}

	let instance: LoggableTest;

	beforeEach(() => {
		instance = new LoggableTest();
	});

	it('should provide a log$ observable', () => {
		expect(instance.log$).toBeDefined();
	});

	it('should preserve the base class functionality', () => {
		expect(instance.baseMethod()).toBe('base method called');
		expect(instance.customBaseMethod()).toBe('Extended base method called');
	});

	it('should emit log entries when log method is called', async () => {
		// Set up a collector for logs
		const logsPromise = firstValueFrom(instance.log$.pipe(take(3), toArray()));
		
		// Emit some logs using the log method with different levels
		instance.logToStream(LogLevel.INFO, 'Info message');
		instance.logToStream(LogLevel.WARN, 'Warning message');
		instance.logToStream(LogLevel.ERROR, 'Error message', new Error('Test error'));
		
		// Get the collected logs
		const logs = await logsPromise;
		
		// Verify logs
		expect(logs.length).toBe(3);
		
		expect(logs[0].level).toBe(LogLevel.INFO);
		expect(logs[0].message).toBe('Info message');
		expect(logs[0].context).toBe('LoggableTest');
		
		expect(logs[1].level).toBe(LogLevel.WARN);
		expect(logs[1].message).toBe('Warning message');
		
		expect(logs[2].level).toBe(LogLevel.ERROR);
		expect(logs[2].message).toBe('Error message');
		expect(logs[2].data).toBeInstanceOf(Error);
	});

	it('should allow custom context in logs', async () => {
		const logsPromise = firstValueFrom(instance.log$.pipe(take(1)));
		
		instance.logToStream(LogLevel.DEBUG, 'Custom context log', null, 'CustomContext');
		
		const log = await logsPromise;
		expect(log.context).toBe('CustomContext');
	});

	it('should include timestamp in logs', async () => {
		const logsPromise = firstValueFrom(instance.log$.pipe(take(1)));
		
		instance.logToStream(LogLevel.DEBUG, 'Debug with timestamp');
		
		const log = await logsPromise;
		expect(log.timestamp).toBeInstanceOf(Date);
	});

	it('should include optional data in logs', async () => {
		const testData = { key: 'value', nested: { prop: 42 } };
		const logsPromise = firstValueFrom(instance.log$.pipe(take(1)));
		
		instance.logToStream(LogLevel.VERBOSE, 'Data log', testData);
		
		const log = await logsPromise;
		expect(log.data).toEqual(testData);
	});

	it('should support convenience logging methods', async () => {
		// Set up a collector for logs
		const logsPromise = firstValueFrom(instance.log$.pipe(take(5), toArray()));
		
		// Use convenience methods
		instance.logToStream(LogLevel.DEBUG, 'Debug message');
		instance.logToStream(LogLevel.INFO, 'Info message');
		instance.logToStream(LogLevel.WARN, 'Warning message');
		instance.logToStream(LogLevel.ERROR, 'Error message');
		instance.logToStream(LogLevel.VERBOSE, 'Verbose message');
		
		// Get collected logs
		const logs = await logsPromise;
		
		// Verify log levels
		expect(logs[0].level).toBe(LogLevel.DEBUG);
		expect(logs[1].level).toBe(LogLevel.INFO);
		expect(logs[2].level).toBe(LogLevel.WARN);
		expect(logs[3].level).toBe(LogLevel.ERROR);
		expect(logs[4].level).toBe(LogLevel.VERBOSE);
	});
});