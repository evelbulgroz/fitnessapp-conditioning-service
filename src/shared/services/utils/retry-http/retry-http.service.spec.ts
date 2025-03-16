//jest.unmock('@nestjs/config'); // Replace with the actual path to ConfigService
//jest.disableAutomock(); // Disable automocking for the ConfigService class
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import axiosRetry from 'axios-retry';

import { Logger } from '@evelbulgroz/ddd-base';

import * as ConfigFactory from '../../../../../config/test.config';
import { ConfigOptions, RetryConfig } from '../../../domain/config-options.model';
import RetryHttpService from './retry-http.service';

//jest.mock('axios');
jest.mock('axios-retry', () => {
	// mock the axios-retry module, making sure axiosRetry is set up correctly in the service constructor
	const mockAxiosRetry = jest.fn((axiosInstance, options) => {
		axiosInstance.defaults.retryCondition = options.retryCondition;
		axiosInstance.defaults.retryDelay = options.retryDelay;
	});

	// add the isNetworkOrIdempotentRequestError function to the mock
	(mockAxiosRetry as any).isNetworkOrIdempotentRequestError = jest.fn((error) => {
		return error.message === 'Network Error';
	});

	return mockAxiosRetry;
});

const mockAxiosInstance = {
	request: jest.fn(),
	get: jest.fn(),
	post: jest.fn(),
	put: jest.fn(),
	delete: jest.fn(),
};

const AXIOS_INSTANCE_TOKEN = 'AXIOS_INSTANCE_TOKEN';

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

	let configService: ConfigService;
	let configGetSpy: jest.SpyInstance;
	let logger: Logger;
	let service: RetryHttpService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: AXIOS_INSTANCE_TOKEN,
					useValue: mockAxiosInstance,
				},
				ConfigService,
				{
					provide: Logger,
					useValue: {
						warn: jest.fn(),
						error: jest.fn(),
					},
				},
				RetryHttpService,
				/*{
					provide: ConfigService,
					useValue: {
						get: (key: string) => {
							console.debug('ConfigService.get called with key:', key);
							if (key === 'defaults') {
								return testConfig.defaults;
							}
							if (key === 'services') {
								return testConfig.services;
							}
							return undefined;
						},
					},
				},*/
				
			],
		})
		.compile();

		service = module.get<RetryHttpService>(RetryHttpService);
		configService = module.get<ConfigService>(ConfigService);
		console.debug('ConfigService in test:', configService); // bug: ConfigService instance here, but service receives a mock
		console.debug('Is ConfigService.get mocked in test:', jest.isMockFunction(ConfigService.prototype.get));
		logger = module.get<Logger>(Logger);
		
		// spy on ConfigService.get to return the test config
		configGetSpy = jest.spyOn(configService, 'get').mockImplementation((key: string) => { // bug: never called, service uses a mock instead
			console.debug('ConfigService.get called with key:', key);
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

	xit('can be created', () => {
		expect(service).toBeDefined();
	});

	xit('configures axios-retry with correct retryCondition and retryDelay', () => { // passes
		// assert that axios-retry was called with the correct options
		expect(axiosRetry).toHaveBeenCalledWith(service['axiosRef'], {
			retries: expect.any(Number),
			retryCondition: expect.any(Function),
			retryDelay: expect.any(Function),
		});
	});

	it('calls retryCondition for retryable errors', () => {
		// arrange
		const mockError = {
		config: { url: testUrl },
		response: { status: 500 },
		message: 'Test error',
		};	
		const retryCondition = (service['axiosRef'].defaults as any)?.retryCondition;		
		expect(typeof retryCondition).toBe('function'); // sanity check: ensure retryCondition is a function
		
		// act/assert
		expect(retryCondition(mockError)).toBe(true); // Should retry for 500 status code
	});

	xit('retries a request up to the configured maxRetries', async () => { // fails
		console.debug('Making request with axiosRef:', service['axiosRef']);

		// arrange
		const mockResponse = { data: 'success' };
		const mockError = {
			config: { url: testUrl },
			response: { status: 500 },
			message: 'Test error',
		};

		jest.spyOn(service['axiosRef'], 'get')
			.mockRejectedValueOnce(mockError) // first request fails
			.mockRejectedValueOnce(mockError) // second request fails
			.mockResolvedValueOnce(mockResponse); // third request succeeds

		// act
		console.debug('Starting test for retries...');
		const response = await service.get(testUrl);
		console.debug('Response received:', response);

		// assert
		//expect(response.data).toBe('success');
		expect(service['axiosRef'].get).toHaveBeenCalledTimes(3); // Retries twice, then succeeds
		expect(logger.warn).toHaveBeenCalledWith(`RetryCondition triggered for URL: ${testUrl}`);
		expect(logger.warn).toHaveBeenCalledWith(`HTTP Status Code: 500`);
	});

	xit('applies the correct retry delay', async () => {
		// arrange
		const mockResponse = { data: 'success' };
		const mockError = {
		config: { url: 'https://localhost:3000/test' },
		response: { status: 500 },
		message: 'Test error',
		};

		jest.spyOn(service['axiosRef'], 'get')
		.mockRejectedValueOnce(mockError) // First request fails
		.mockResolvedValueOnce(mockResponse); // Second request succeeds

		const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

		// act
		const response = await service.get('/test');

		// assert
		//expect(response.data).toBe('success');
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200); // Retry delay from endpoint config
		setTimeoutSpy.mockRestore();
	});

	xit('does not retry if maxRetries is reached', async () => {
		// arrange
		const mockError = {
		config: { url: 'https://localhost:3000/test' },
		response: { status: 500 },
		message: 'Test error',
		};

		jest.spyOn(service['axiosRef'], 'get').mockRejectedValue(mockError); // Always fails

		// act & Assert
		await expect(service.get('/test')).rejects.toThrow('Test error');
		expect(service['axiosRef'].get).toHaveBeenCalledTimes(2); // Retries once, then fails
		expect(logger.warn).toHaveBeenCalledWith('RetryCondition: Max retries reached. No further retries will be attempted.');
	});

	xit('does not retry for non-retryable errors', async () => {
		// arrange
		const mockError = {
		config: { url: 'https://localhost:3000/test' },
		response: { status: 400 }, // Client error, not retryable
		message: 'Bad Request',
		};

		jest.spyOn(service['axiosRef'], 'get').mockRejectedValue(mockError);

		// act & Assert
		await expect(service.get('/test')).rejects.toThrow('Bad Request');
		expect(service['axiosRef'].get).toHaveBeenCalledTimes(1); // No retries
		expect(logger.warn).toHaveBeenCalledWith('Retry Reason: Other');
	});
});