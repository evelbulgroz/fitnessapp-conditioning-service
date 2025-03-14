import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import axios from 'axios';
import axiosRetry from 'axios-retry';

import { Logger } from '@evelbulgroz/ddd-base';

import createTestingModule from '../../../../test/test-utils';
import RetryHttpService from './retry-http.service';
import { EndPointConfig, ServiceConfig } from '../../../domain/config-options.model';

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
	let endPointConfig: EndPointConfig;
	let logger: Logger;
	let service: RetryHttpService;
	let serviceConfig: ServiceConfig;
	let serviceName: string;
	
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				// createTestingModule() initializes initializes ConfigModule with test config
				ConfigService,
				{ // Mock Axios instance token
					provide: AXIOS_INSTANCE_TOKEN,
					useValue: mockAxiosInstance,
				},				
				{ // Mock HttpService
					provide: HttpService,
					useFactory: (axiosInstance) => new HttpService(axiosInstance),
					inject: [AXIOS_INSTANCE_TOKEN],
				},		
				{ // Mock Logger
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
		console.debug('configService:', configService); // bug: configService is correct here, but mocked in service
		logger = module.get<Logger>(Logger);
		service = module.get<RetryHttpService>(RetryHttpService);
		serviceName = 'fitnessapp-registry-service';
		serviceConfig = configService.get('services')[serviceName];
		endPointConfig = Object.values(serviceConfig?.endpoints ?? {})[0]; // grab first endpoint
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
		const retryDelay = service['getRetryConfig'](serviceConfig.baseURL.href + endPointConfig.path);
		expect(retryDelay).toBe(2000);
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