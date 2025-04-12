import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { LoggingGuard } from './logging.guard';

import { jest } from '@jest/globals';

import { Logger } from '@evelbulgroz/logger';

describe('LoggingGuard', () => {
	let loggingGuard: LoggingGuard;
	let logger: Logger;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LoggingGuard,
				{ // Logger (suppress console output)
					provide: Logger,
					useValue: {
						log: jest.fn(),
						error: jest.fn(),
						warn: jest.fn(),
						debug: jest.fn(),
						verbose: jest.fn(),
					},
				},
			],
		})
		.compile();
		
		logger = module.get<Logger>(Logger);
		loggingGuard = module.get<LoggingGuard>(LoggingGuard);		
	});

	it('can be created', () => {
		expect(loggingGuard).toBeDefined();
	});

	it('should log the access attempt', () => {
		const mockRequest = {
			user: { username: 'testuser' },
			method: 'GET',
			url: '/test-url',
		};
		const mockContext = {
			switchToHttp: jest.fn().mockReturnValue({
				getRequest: jest.fn().mockReturnValue(mockRequest),
			}),
		} as any as ExecutionContext;

		const result = loggingGuard.canActivate(mockContext);

		expect(logger.log).toHaveBeenCalledWith('User testuser accessed GET /test-url');
		expect(result).toBe(true);
	});

	it('should log "unknown" if user is not defined', () => {
		const mockRequest = {
			user: undefined,
			method: 'GET',
			url: '/test-url',
		};
		const mockContext = {
			switchToHttp: jest.fn().mockReturnValue({
				getRequest: jest.fn().mockReturnValue(mockRequest),
			}),
		} as any as ExecutionContext;

		const result = loggingGuard.canActivate(mockContext);

		expect(logger.log).toHaveBeenCalledWith('User unknown accessed GET /test-url');
		expect(result).toBe(true);
	});
});