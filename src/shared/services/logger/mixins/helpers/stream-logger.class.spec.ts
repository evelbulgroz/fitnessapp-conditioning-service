import { Subject } from 'rxjs';

import LogLevel from '../../models/log-level.enum';
import LoggableComponent from '../../models/loggable-component.model';
import StreamLogger from './stream-logger.class';
import UnifiedLogEntry from '../../models/unified-log-event.model';

describe('StreamLogger', () => {
	// Create a mock LoggableComponent implementation
	class MockLoggableComponent implements LoggableComponent {
		public readonly log$ = new Subject<UnifiedLogEntry>();
		public readonly logger: StreamLogger = new StreamLogger(this);
		public logToStream = jest.fn();
	}

	let mockLogSource: MockLoggableComponent;
	let streamLogger: StreamLogger;

	beforeEach(() => {
		// Reset mocks before each test
		mockLogSource = new MockLoggableComponent();
		streamLogger = mockLogSource.logger;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(streamLogger).toBeDefined();
		expect(streamLogger).toBeInstanceOf(StreamLogger);
	});

	describe('Logging methods', () => {
		const testMessage = 'Test message';
		const testContext = 'TestContext';

		it('calls logToStream with ERROR level when error() is called', () => {
			// Test with just message
			streamLogger.error(testMessage);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.ERROR, testMessage, undefined, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with string trace
			const stringTrace = 'Error trace';
			streamLogger.error(testMessage, stringTrace);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.ERROR, testMessage, stringTrace, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with Error object
			const errorTrace = new Error('Test error');
			streamLogger.error(testMessage, errorTrace);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.ERROR, testMessage, errorTrace, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with context
			streamLogger.error(testMessage, stringTrace, testContext);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.ERROR, testMessage, stringTrace, testContext);
		});

		it('calls logToStream with WARN level when warn() is called', () => {
			// Test with just message
			streamLogger.warn(testMessage);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.WARN, testMessage, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with context
			streamLogger.warn(testMessage, testContext);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.WARN, testMessage, testContext);
		});

		it('calls logToStream with INFO level when info() is called', () => {
			// Test with just message
			streamLogger.info(testMessage);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.INFO, testMessage, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with context
			streamLogger.info(testMessage, testContext);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.INFO, testMessage, testContext);
		});

		it('calls logToStream with DEBUG level when debug() is called', () => {
			// Test with just message
			streamLogger.debug(testMessage);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.DEBUG, testMessage, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with context
			streamLogger.debug(testMessage, testContext);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.DEBUG, testMessage, testContext);
		});

		it('calls logToStream with VERBOSE level when verbose() is called', () => {
			// Test with just message
			streamLogger.verbose(testMessage);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.VERBOSE, testMessage, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with context
			streamLogger.verbose(testMessage, testContext);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.VERBOSE, testMessage, testContext);
		});

		it('calls logToStream with LOG level when log() is called', () => {
			// Test with just message
			streamLogger.log(testMessage);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.LOG, testMessage, undefined);
			
			// Reset mock
			mockLogSource.logToStream.mockClear();
			
			// Test with context
			streamLogger.log(testMessage, testContext);
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.LOG, testMessage, testContext);
		});
	});

	describe('Edge cases', () => {
		it('handles empty message', () => {
			streamLogger.log('');
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.LOG, '', undefined);
		});

		it('handles empty context', () => {
			streamLogger.log('Test message', '');
			expect(mockLogSource.logToStream).toHaveBeenCalledWith(LogLevel.LOG, 'Test message', '');
		});
	});
});