import { ConsoleLogger } from './console-logger';

describe('ConsoleLogger', () => {
	let logger: ConsoleLogger;
	let consoleSpy: jest.SpyInstance;

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe('Log Levels', () => {
		beforeEach(() => {
			logger = new ConsoleLogger('TestContext', 'debug', true);
		});

		it('logs messages at the "log" level', () => {
			logger.log('Test log message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[LOG]'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test log message'));
		});

		it('logs messages at the "warn" level', () => {
			logger.warn('Test warn message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test warn message'));
		});

		it('logs messages at the "error" level', () => {
			logger.error('Test error message', 'Test stack trace');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test error message'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test stack trace'));
		});

		it('logs messages at the "info" level', () => {
			logger.info('Test info message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test info message'));
		});

		it('logs messages at the "debug" level', () => {
			logger.debug('Test debug message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test debug message'));
		});

		it('logs messages at the "verbose" level', () => {
			logger.verbose('Test verbose message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[VERBOSE]'));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test verbose message'));
		});
	});

	describe('Log Level Filtering', () => {
		it('does not log messages below the configured log level', () => {
			logger = new ConsoleLogger('TestContext', 'warn', true);

			logger.debug('Test debug message');
			logger.info('Test info message');
			logger.log('Test log message');

			expect(consoleSpy).not.toHaveBeenCalled();

			logger.warn('Test warn message');
			logger.error('Test error message');

			expect(consoleSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('Context Formatting', () => {
		it('includes the context in log messages if provided', () => {
			logger = new ConsoleLogger('TestContext', 'debug', true);

			logger.log('Test log message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[TestContext]'));
		});

		it('does not include the context in log messages if not provided', () => {
			logger = new ConsoleLogger(undefined, 'debug', true);

			logger.log('Test log message');
			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('['));
		});
	});

	describe('Color Output', () => {
		it('applies colors to log messages if useColors is true', () => {
			logger = new ConsoleLogger('TestContext', 'debug', true);

			logger.log('Test log message');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m')); // Green for log
		});

		it('does not apply colors to log messages if useColors is false', () => {
			logger = new ConsoleLogger('TestContext', 'debug', false);

			logger.log('Test log message');
			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('\x1b'));
		});
	});

	describe('Error Logging with Stack Trace', () => {
		it('logs error messages with a stack trace if provided', () => {
			logger = new ConsoleLogger('TestContext', 'debug', true);

			logger.error('Test error message', 'Test stack trace');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test stack trace'));
		});

		it('logs error messages without a stack trace if not provided', () => {
			logger = new ConsoleLogger('TestContext', 'debug', true);

			logger.error('Test error message');
			expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Test stack trace'));
		});
	});
});