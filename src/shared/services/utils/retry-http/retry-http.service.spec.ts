import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import axiosRetry from 'axios-retry';

import { Logger } from '@evelbulgroz/ddd-base';

import * as ConfigFactory from '../../../../../config/test.config';
import { ConfigOptions, RetryConfig } from '../../../domain/config-options.model';
import createTestingModule from '../../../../test/test-utils';
import RetryHttpService from './retry-http.service';

jest.mock('axios');
jest.mock('axios-retry');

const mockAxiosInstance = {
	request: jest.fn(),
	get: jest.fn(),
	post: jest.fn(),
	put: jest.fn(),
	delete: jest.fn(),
};

const AXIOS_INSTANCE_TOKEN = 'AXIOS_INSTANCE_TOKEN';

describe('RetryHttpService', () => {
	let configService: ConfigService;
	let logger: Logger;
	let service: RetryHttpService;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				// createTestingModule() initializes ConfigModule with test config
				{
					provide: AXIOS_INSTANCE_TOKEN,
					useValue: mockAxiosInstance,
				},
				{
					provide: HttpService,
					useFactory: (axiosInstance) => new HttpService(axiosInstance),
					inject: [AXIOS_INSTANCE_TOKEN],
				},
				{
					provide: Logger,
					useValue: {
						warn: jest.fn(),
						error: jest.fn(),
					},
				},
				RetryHttpService,
			],
		}))
		.compile();

		configService = module.get<ConfigService>(ConfigService);
		logger = module.get<Logger>(Logger);
		service = new RetryHttpService(configService, logger); //module.get<RetryHttpService>(RetryHttpService); // bug: module.get injects mock of ConfigService, can't figure out why
	});

	let configGetSpy: jest.SpyInstance;
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

		// mock ConfigService.get() to return modified test config
		configGetSpy = jest.spyOn(configService, 'get').mockImplementation((key: string) => {
			if (key === 'defaults') {
				return testConfig.defaults;
			}
			if (key === 'services') {
				return testConfig.services;
			}
			return undefined;
		});

		// compose test URL
		testUrl = serviceConfig?.baseURL?.href + endPointConfig?.path;
	});

	afterEach(() => {
		configGetSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(service).toBeDefined();
	});

	it('configures axios-retry with default settings', () => {
		expect(axiosRetry).toHaveBeenCalledWith(service.axiosRef, expect.any(Object));
	});
	
	it('logs retry attempts', () => {
		// arrange
		const error = {
			config: { url: '/api/endpoint-a' },
			response: { status: 500 },
			message: 'Test error',
		} as any;
		const retryCondition = (axiosRetry as unknown as jest.Mock).mock.calls[0][1].retryCondition;

		// act
		retryCondition(error);

		// assert
		expect(logger.warn).toHaveBeenCalledWith('RetryCondition triggered for URL: /api/endpoint-a');
		expect(logger.warn).toHaveBeenCalledWith('HTTP Status Code: 500');
		expect(logger.error).toHaveBeenCalledWith('Error Message: Test error');
	});
	
	it('stops retrying after max retries', () => {
		// arrange
		const error = {
		config: { url: '/api/endpoint-a', 'axios-retry': { retryCount: 5 } },
		response: { status: 500 },
		message: 'Test error',
		} as any;
		const retryCondition = (axiosRetry as unknown as jest.Mock).mock.calls[0][1].retryCondition;
		
		// act
		const shouldRetry = retryCondition(error);

		// assert
		expect(shouldRetry).toBe(false);
		expect(logger.warn).toHaveBeenCalledWith('RetryCondition: Max retries reached. No further retries will be attempted.');
	});

	xit('delays retries according to retryDelay', () => {
		// arrange
		const error = {
		config: { url: '/api/endpoint-a' },
		response: { status: 500 },
		message: 'Test error',
		} as any;
		const retryDelay = (axiosRetry as unknown as jest.Mock).mock.calls[0][1].retryDelay;

		// act
		const delay = retryDelay(error);

		// assert
		expect(delay).toBe(100);
	});
	
	it('retries on network or idempotent request errors', () => {
		// arrange
		const error = {
		config: { url: '/api/endpoint-a' },
		response: { status: 500 },
		message: 'Test error',
		} as any;
		const retryCondition = (axiosRetry as unknown as jest.Mock).mock.calls[0][1].retryCondition;
		
		// act
		const shouldRetry = retryCondition(error);

		// assert
		expect(shouldRetry).toBe(true);
		expect(logger.warn).toHaveBeenCalledWith('Retry Reason: Network error or 5xx status code');
	});

	describe('Protected methods', () => {
		describe('getRetryConfig', () => {
			it('returns endpoint-specific retry configuration, if available', () => {
				// act
				const retryConfig = service['getRetryConfig'](testUrl);
				
				// assert
				expect(retryConfig).toEqual(endPointRetryConfig);
			});

			it('returns service-specific retry configuration, if endpoint-specific is not available', () => {
				// arrange
				testConfig.services[serviceName].endpoints![endPointName].retry = undefined;

				// act
				const retryConfig = service['getRetryConfig'](testUrl);

				// assert
				expect(retryConfig).toEqual(serviceRetryConfig);
			});

			it('returns default retry configuration, if neither endpoint- nor service-specific is available', () => {
				// arrange
				testConfig.services[serviceName].retry = undefined;
				testConfig.services[serviceName].endpoints![endPointName].retry = undefined;

				// act
				const retryConfig = service['getRetryConfig'](testUrl);

				// assert
				expect(retryConfig).toEqual(defaultRetryConfig);
			});

			it('returns undefined for unknown endpoint configurations', () => {
				// arrange
				const config = service['getRetryConfig']('/unknown-endpoint');

				// act/assert
				expect(config).toBeUndefined();
			});	
		});
	});
});