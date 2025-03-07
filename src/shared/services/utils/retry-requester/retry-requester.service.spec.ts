import { HttpService } from '@nestjs/axios';
import { RequestMethod } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';

import { jest } from '@jest/globals';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';


import { createTestingModule } from '../../../../test/test-utils';
import { RetryRequesterService } from './retry-requester.service';

// process.env.NODE_ENV = 'not-test'; // set NODE_ENV to 'not-test' to suppress console logs

describe('RetryRequesterService', () => {
	let httpService: HttpService;
	let service: RetryRequesterService;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			providers: [
				{
					provide: HttpService,
					useValue: {
						get: jest.fn(),
						post: jest.fn()
					},
				},
				{
					provide: Logger,
					useClass: ConsoleLogger,
				},
				RetryRequesterService,
			],
		}))
		.compile();

		service = module.get<RetryRequesterService>(RetryRequesterService);
		httpService = module.get<HttpService>(HttpService);
	});

	let url: string;
	let method: RequestMethod;
	let body: any;
	let config: any;
	let attempts: number;
	let retryDelay: number;
	let httpGetSpy: any;
	let httpPostSpy: any;
	beforeEach(() => {
		url = 'http://localhost:3000';
		method = RequestMethod.POST;
		body = {
			foo: 'bar',
		};
		config = {
			headers: {
				'Content-Type': 'application/json',
			},
		};
		attempts = 3;
		retryDelay = 50;
	});
	
	afterEach(() => {
		httpGetSpy && httpGetSpy.mockRestore
		httpPostSpy && httpPostSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(service).toBeDefined();
	});

	it('can execute a POST request', () => {
		// arrange
		const httpPostSpy = jest.spyOn(httpService, 'post').mockReturnValueOnce(of({data: 'test'}) as any);

		// act	
		const request$ = service.execute(url, method, body, config, attempts, retryDelay, service);

		// assert
		expect(request$).toBeDefined();
		expect(httpPostSpy).toHaveBeenCalledTimes(1);
	});

	it('can retry a POST request', async () => {
		// arrange
		const error = new Error('test error');
    	const successResponse = { status: 200, data: 'success' };

    	//st.spyOn(httpService, 'post')
		httpPostSpy = jest.spyOn(httpService, 'post')
			.mockReturnValueOnce(throwError(() => error))
			.mockReturnValueOnce(throwError(() => error))
			.mockReturnValueOnce(of(successResponse) as any);

		// act
		const request$ = service.execute(url, method, body, config, attempts, retryDelay, service);
		const response = await firstValueFrom(request$);

		// assert
		expect(request$).toBeDefined();
		expect(response).toEqual(successResponse);
		expect(httpPostSpy).toHaveBeenCalledTimes(attempts);
	});

	it('can execute a GET request', () => {
		// arrange
		httpGetSpy = jest.spyOn(httpService, 'get').mockReturnValueOnce(of({data: 'test'}) as any);

		// act	
		const request$ = service.execute(url, RequestMethod.GET, body, config, attempts, retryDelay, service);

		// assert
		expect(request$).toBeDefined();
		expect(httpGetSpy).toHaveBeenCalledTimes(1);
	});

	it('can retry a GET request', async () => {
		// arrange
		const error = new Error('test error');
		const successResponse = { status: 200, data: 'success' };

		httpGetSpy = jest.spyOn(httpService, 'get')
			.mockReturnValueOnce(throwError(() => error))
			.mockReturnValueOnce(throwError(() => error))
			.mockReturnValueOnce(of(successResponse) as any);

		// act
		const request$ = service.execute(url, RequestMethod.GET, body, config, attempts, retryDelay, service);
		const response = await firstValueFrom(request$);

		// assert
		expect(request$).toBeDefined();
		expect(response).toEqual(successResponse);
		expect(httpGetSpy).toHaveBeenCalledTimes(attempts);
	});
});
