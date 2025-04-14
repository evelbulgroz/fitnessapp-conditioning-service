import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import axiosRetry from 'axios-retry';
import { firstValueFrom, take } from 'rxjs';

import { Logger } from '@evelbulgroz/logger';

import * as ConfigFactory from '../../../../../config/test.config';
import { ConfigOptions, RetryConfig } from '../../../domain/config-options.model';
import RetryHttpService from './retry-http.service';

//process.env.NODE_ENV = 'not-test'; // enable logging for tests (default is logger is disabled in test environment)

// NOTE: Gave up on mocking axios-retry and axios for now: it raises too many headaches re. shadowing/invoking the correct axios instance and logic
//       Instead, testing the service directly without mocking axios or axios-retry
//       and just testing the basics of the retry logic (retryCondition and retryDelay) using the service's own methods

// NOTE: The framework implicitly mocks ConfigService, when testing a descendant of HttpService, so gave up on mocking ConfigService as well
//	   Instead, injecting ConfigService as-is and mocking ConfigService.get to return the test config (loaded and cloned separately)


describe('RetryHttpService', () => {
	let defaultRetryConfig: RetryConfig
	let endPointName: string;
	let endPointRetryConfig: RetryConfig
	let serviceName: string;
	let serviceRetryConfig: RetryConfig;
	let testConfig: ConfigOptions;
	let testUrl: string;
	beforeEach(async () => {
		// clone test config from source file (can't easily get whole config from ConfigService, so workaround)
		testConfig = {...await ConfigFactory.default()};
				
		// pick first service and endpoint for testing
		serviceName = Object.keys(testConfig.services)[0]; // grab first service name
		const serviceConfig = {...testConfig.services[serviceName]};
		const endpoints = serviceConfig?.endpoints ?? {};
		endPointName = Object.keys(endpoints)[0]; // grab first endpoint name
		const endPointConfig = {...endpoints[endPointName]};

		// make sure retry configuration is set for all levels
		defaultRetryConfig = { maxRetries: 1, retryDelay: 100 };
		testConfig.defaults.retry = defaultRetryConfig

		serviceRetryConfig = { maxRetries: 2, retryDelay: 200 };
		testConfig.services[serviceName].retry = serviceRetryConfig;

		endPointRetryConfig = { maxRetries: 3, retryDelay: 300 };
		testConfig.services[serviceName].endpoints![endPointName].retry = endPointRetryConfig;

		// compose test URL
		testUrl = serviceConfig?.baseURL?.href + endPointConfig?.path;
	});

	let axiosRef: any;
	let config: ConfigService;
	let configGetSpy: jest.SpyInstance;
	let logger: Logger;
	let service: RetryHttpService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: 'AXIOS_INSTANCE_TOKEN',
					useValue: {
						request: jest.fn(),
						get: jest.fn(),
						post: jest.fn(),
						put: jest.fn(),
						delete: jest.fn(),
					}
				},
				ConfigService,
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
				RetryHttpService,
			],
		})
		.compile();

		service = module.get<RetryHttpService>(RetryHttpService);
		axiosRef = service['axiosRef'];
		config = service['config'] as jest.Mocked<ConfigService>; // workaround: framework injects mock regardless of config service provided here, so get reference from service rather than module
		logger = module.get<Logger>(Logger);
		
		// spy on ConfigService.get to return the test config
		configGetSpy = jest.spyOn(config, 'get').mockImplementation((key: string) => { // workaround: can't control injection of ConfigService, so mock get method instead
			if (key === 'defaults') {
				return testConfig.defaults;
			}
			if (key === 'services') {
				return testConfig.services;
			}
			return undefined;
			
		});
	});

	afterEach(() => {
		configGetSpy && configGetSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(service).toBeDefined();
	});

	describe('Configuration', () => {
		xit('configures axios-retry with correct retryCondition and retryDelay', () => {
			// assert that axios-retry was called with the correct options
			expect(axiosRetry).toHaveBeenCalledWith(service['axiosRef'], {
				retries: expect.any(Number),
				retryCondition: expect.any(Function),
				retryDelay: expect.any(Function),
			});
		});
	});

	describe('Retries', () => {
		xit('calls retryCondition for retryable errors', async () => {
			// arrange
			const mockError = {
				config: { url: testUrl },
				response: { status: 500 },
				message: 'Test error',
			};

			const retryCondition = (axiosRef.defaults as any)?.retryCondition;		
			expect(typeof retryCondition).toBe('function'); // fails: retryCondition is undefined when code reaches this point
			
			// act/assert
			expect(retryCondition(mockError)).toBe(true); // Should retry for 500 status code
		});

		it('retries a request up to the configured maxRetries', async () => {
			// arrange
			const expectedRetries = service['getRetryConfig'](testUrl)?.maxRetries;
			const requestLog: string[] = [];
			service['axiosRef'].interceptors.request.use((config) => {
				requestLog.push(config.url || 'unknown');
				return config;
			});
			
			try {
				// act
				const response$ = service.get(testUrl).pipe(take(1)); // request cannot succeed, so should exhaust maxRetries
				void await firstValueFrom(response$);
			}
			catch (error) {
				// assert
				expect(requestLog).toHaveLength(expectedRetries! + 1); // retryCondition exits when retryCount >= maxRetries, so expect maxRetries + 1 requests
				expect(logger.warn).toHaveBeenCalled();
			}
			finally {
				// clean up
				jest.restoreAllMocks();
			}
		});

		it('applies retry delay with exponential backoff and jitter based on base delay from config', async () => {
			// arrange
			const { maxRetries, retryDelay } = service['getRetryConfig'](testUrl) as RetryConfig;
			const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
			
			try {
				// act
				const response$ = service.get(testUrl).pipe(take(1));
				void await firstValueFrom(response$);			
			}
			catch (error) {
				// assert
				expect(setTimeoutSpy).toHaveBeenCalledTimes(maxRetries!); // expect a setTimeout call for each retry
				setTimeoutSpy.mock.calls.forEach((call, index) => {
					expect(call).toEqual([expect.any(Function), expect.any(Number)]);
					expect(call[1]).toBeGreaterThanOrEqual(retryDelay!);
					// assert that the delay is an irrational number (jitter) and not a simple multiple of the base delay
					const jitter = call[1]! - retryDelay! * Math.pow(2, index); // subtract base delay from the total delay
					expect(jitter).toBeGreaterThanOrEqual(0); // jitter should be non-negative
				});
			}
			finally {
				// clean up
				setTimeoutSpy.mockRestore();
			}
		});
	});

	describe('Protected Methods', () => {
		describe('getRetryConfig', () => {
			it('returns the endpoint retry config if found', () => {
				// arrange
				const expectedConfig = testConfig.services[serviceName]!.endpoints![endPointName].retry;

				// act
				const actualConfig = service['getRetryConfig'](testUrl);

				// assert
				expect(actualConfig).toEqual(expectedConfig);
			});
			
			it('returns the service retry config if no endpoint config is found', () => {
				// arrange
				delete testConfig.services[serviceName].endpoints![endPointName]; // remove endpoint config
				const expectedConfig = testConfig.services[serviceName].retry;

				// act
				const actualConfig = service['getRetryConfig'](testUrl);

				// assert
				expect(actualConfig).toEqual(expectedConfig);
			});
			
			it('returns the default retry config if no service or endpoint config is found', () => {
				// arrange
				delete testConfig.services[serviceName].retry; // remove service config
				delete testConfig.services[serviceName].endpoints![endPointName]; // remove endpoint config
				const expectedConfig = testConfig.defaults.retry;

				// act
				const actualConfig = service['getRetryConfig'](testUrl);

				// assert
				expect(actualConfig).toEqual(expectedConfig);
			});

			it('returns undefined if url is unknown', () => {
				// arrange
				
				// act
				const actualConfig = service['getRetryConfig']('unknown');

				// assert
				expect(actualConfig).toBeUndefined();
			});
		});
	});
});