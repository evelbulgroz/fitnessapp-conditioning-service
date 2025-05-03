import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';

import { jest } from '@jest/globals';
import { Subject } from 'rxjs';

import { StreamLogger } from '../../libraries/stream-loggable';

import { LoggingGuard } from './logging.guard';

describe('LoggingGuard', () => {
	let logger: StreamLogger;
	let loggingGuard: LoggingGuard;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LoggingGuard
			],
		})
		.compile();
		
		loggingGuard = module.get<LoggingGuard>(LoggingGuard);
		logger = loggingGuard.logger as StreamLogger;
		jest.spyOn(logger, 'info').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(loggingGuard).toBeDefined();
	});

	describe('canActivate', () => {
		it('logs the access attempt', () => {
			const mockRequest = {
				user: { username: 'testuser' },
				method: 'GET',
				url: '/test-url',
			};
			const mockContext = {
				getClass: jest.fn().mockReturnValue('TestController'),
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: jest.fn().mockReturnValue(mockRequest),
				}),
			} as any as ExecutionContext;

			const result = loggingGuard.canActivate(mockContext);

			expect(logger.info).toHaveBeenCalledWith('User unknown (unknown id) accessed GET /test-url', undefined);
			expect(result).toBe(true);
		});

		it('logs "unknown" if user is not defined', () => {
			const mockRequest = {
				user: undefined,
				method: 'GET',
				url: '/test-url',
			};
			const mockContext = {
				getClass: jest.fn().mockReturnValue('TestController'),
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: jest.fn().mockReturnValue(mockRequest),
				}),
			} as any as ExecutionContext;

			const result = loggingGuard.canActivate(mockContext);

			expect(logger.info).toHaveBeenCalledWith('User unknown (unknown id) accessed GET /test-url', undefined);
			expect(result).toBe(true);
		});

		it('logs "unknown id" if userId is not defined', () => {
			const mockRequest = {
				user: { userName: 'testuser', userId: undefined },
				method: 'GET',
				url: '/test-url',
			};
			const mockContext = {
				getClass: jest.fn().mockReturnValue('TestController'),
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: jest.fn().mockReturnValue(mockRequest),
				}),
			} as any as ExecutionContext;

			const result = loggingGuard.canActivate(mockContext);

			expect(logger.info).toHaveBeenCalledWith('User testuser (unknown id) accessed GET /test-url', undefined);
			expect(result).toBe(true);
		});

		it('uses log level "info"', () => {
			const mockRequest = {
				user: { userName: 'testuser', userId: '123' },
				method: 'GET',
				url: '/test-url',
			};

			const mockContext = {
				getClass: jest.fn().mockReturnValue('TestController'),
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: jest.fn().mockReturnValue(mockRequest),
				}),
			} as any as ExecutionContext;
			const result = loggingGuard.canActivate(mockContext);

			expect(logger.info).toHaveBeenCalled();
			expect(result).toBe(true);
		});
	});

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(loggingGuard.log$).toBeDefined();
				expect(loggingGuard.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(loggingGuard.logger).toBeDefined();
				expect(loggingGuard.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(loggingGuard.logToStream).toBeDefined();
				expect(typeof loggingGuard.logToStream).toBe('function');
			});
		});
	});
});