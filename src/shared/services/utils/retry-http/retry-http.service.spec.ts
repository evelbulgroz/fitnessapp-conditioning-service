import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import axios from 'axios';
import axiosRetry from 'axios-retry';

import { Logger } from '@evelbulgroz/ddd-base';

import createTestingModule from '../../../../test/test-utils';
import RetryHttpService from './retry-http.service';
import { AppConfig, ConfigOptions, EndPointConfig, RetryConfig, ServiceConfig } from '../../../domain/config-options.model';

//jest.mock('axios');
//jest.mock('axios-retry');

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

	let endpointName: string;
	let endPointConfig: EndPointConfig;
	let serviceConfig: ServiceConfig;	
	let serviceName: string;
	let testConfig: ConfigOptions;
	let testUrl: string;
	beforeEach(() => {
		testConfig = {
			environment: 'test',
			app: {...configService.get('app')} as AppConfig,
			defaults: {
				commandQueue: { throttleTime: 50 },
				retry: { maxRetries: 1, retryDelay: 1000 },
			},
			modules: {} as any,
			security: {} as any,
			services: {...configService.get('services')},
		};

		serviceName = Object.keys(testConfig.services)[0]; // grab first service name
		serviceConfig = testConfig.services[serviceName];
		endpointName = Object.keys(serviceConfig?.endpoints ?? {})[0]; // grab first endpoint name
		endPointConfig = {serviceConfig?.endpoints ?? {}}[endpointName];
		testUrl = serviceConfig?.baseURL?.href + endPointConfig?.path
		console.debug('testConfig:', testConfig);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	xit('can be created', () => {
		expect(service).toBeDefined();
	});

	xit('configures axios-retry with default settings', () => {
		expect(axiosRetry).toHaveBeenCalledWith(service.axiosRef, expect.any(Object));
	});

	it('uses endpoint-specific retry configuration', () => {
		// arrange
		const url = serviceConfig.baseURL.href + endPointConfig.path;
		const configSpy = jest.spyOn(configService, 'get').mockImplementation((key: string) => {
			if (key === 'defaults') {
				return {...testConfig.defaults};
			}
			if (key === 'services') {
				return {...testConfig.services};
			}
			return undefined;
		});

		// act
		const retryDelay = service['getRetryConfig'](url);

		// assert
		expect(configSpy).toHaveBeenCalledWith('services');
		expect(retryDelay).toEqual({"maxRetries": 1, "retryDelay": 1000});

		// cleanup
		configSpy.mockRestore();
	});

	/*xit('should log retry attempts', () => {
		const error = {
		config: { url: '/api/endpoint-a' },
		response: { status: 500 },
		message: 'Test error',
		} as any;

		const retryCondition = (axiosRetry as jest.Mock).mock.calls[0][1].retryCondition;
		retryCondition(error);

		expect(logger.warn).toHaveBeenCalledWith('RetryCondition triggered for URL: /api/endpoint-a');
		expect(logger.warn).toHaveBeenCalledWith('HTTP Status Code: 500');
		expect(logger.error).toHaveBeenCalledWith('Error Message: Test error');
	});

	xit('should stop retrying after max retries', () => {
		const error = {
		config: { url: '/api/endpoint-a', 'axios-retry': { retryCount: 5 } },
		response: { status: 500 },
		message: 'Test error',
		} as any;

		const retryCondition = (axiosRetry as jest.Mock).mock.calls[0][1].retryCondition;
		const shouldRetry = retryCondition(error);

		expect(shouldRetry).toBe(false);
		expect(logger.warn).toHaveBeenCalledWith('RetryCondition: Max retries reached. No further retries will be attempted.');
	});

	xit('should retry on network or idempotent request errors', () => {
		const error = {
		config: { url: '/api/endpoint-a' },
		response: { status: 500 },
		message: 'Test error',
		} as any;

		const retryCondition = (axiosRetry as jest.Mock).mock.calls[0][1].retryCondition;
		const shouldRetry = retryCondition(error);

		expect(shouldRetry).toBe(true);
		expect(logger.warn).toHaveBeenCalledWith('Retry Reason: Network error or 5xx status code');
	});

	xit('should return null for unknown endpoint configurations', () => {
		const config = service['getRetryConfig']('/unknown-endpoint');
		expect(config).toBeNull();
	});
	*/
});