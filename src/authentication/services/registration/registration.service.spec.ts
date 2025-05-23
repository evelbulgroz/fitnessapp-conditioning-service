import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TestingModule } from '@nestjs/testing';

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { of, Subject } from 'rxjs';

import { StreamLogger } from '../../../libraries/stream-loggable';

import { AppConfig, EndPointConfig, ServiceConfig } from '../../../shared/domain/config-options.model';
import AuthService from '../../domain/auth-service.class';
import createTestingModule from '../../../test/test-utils';
import RegistrationService from '../registration/registration.service';
import SecurityConfig from '../../../shared/domain/security.config.model';
import { ServiceDataDTO as RegistryServiceDataDTO } from '../../dtos/responses/service-data.dto';

describe('RegistrationService', () => {
	let authServiceSpy: any
	let authService: AuthService;
	let config: ConfigService;
	let http: HttpService;
	let service: RegistrationService;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			imports: [
				//ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				{
					provide: AuthService,
					useValue: {
						getAuthData: jest.fn()						
					}
				},
				ConfigService,
				RegistrationService,
				{
					provide: HttpService,
					useValue: {
						get: jest.fn(),
						post: jest.fn()
					}
				}
			]
		}))
		.compile();

		authService = module.get<AuthService>(AuthService);	
		config = module.get<ConfigService>(ConfigService);
		http = module.get<HttpService>(HttpService);
		service = module.get<RegistrationService>(RegistrationService);
	});

	let accesstoken: string;
	let authServiceName: string;
	let httpPostSpy: any;
	let registryServiceName: string;
	let userServiceName: string;
	beforeEach(() => {
		authServiceName = 'fitnessapp-authentication-service';
		registryServiceName = 'fitnessapp-registry-service';
		userServiceName = config.get<AppConfig>('app')?.servicename!;
		const securityConfig = config.get<SecurityConfig>('security');
		const tokenSecret = securityConfig?.authentication?.jwt!.accessToken?.secret ?? '';
		accesstoken = jwt.sign({ serviceName: userServiceName }, tokenSecret!);

		authServiceSpy = jest.spyOn(authService, 'getAuthData').mockReturnValue(Promise.resolve(accesstoken));
		httpPostSpy = jest.spyOn(http, 'post').mockImplementation((url: string, data: any, config: any) => {
			if (url.includes('deregister')) {
				return of({ data: true, status: 200 }) as any;
			}
			else if (url.includes('register')) {
				return of({ data: true, status: 200 }) as any;
			}
		});
	});

	afterEach(() => {
		authServiceSpy && authServiceSpy.mockRestore();
		httpPostSpy && httpPostSpy.mockRestore();
		jest.clearAllMocks();
	});

	// NOTE:
	  // Suppress the actual HTTP requests
	  // Do not test injected dependencies
	  // Just check that the request data conform to the requirements of the accessed registry service endpoints
	
	it('can be created', () => {
		expect(service).toBeDefined();
	});

	describe('deregister', () => {
		let expectedUrl: string;
		let expectedBody: RegistryServiceDataDTO;
		let expectedConfig: any;
		beforeEach(() => {
			const appConfig = config.get<AppConfig>('app') ?? {} as AppConfig;
			const registryConfig = config.get<ServiceConfig>(`services.${registryServiceName}`) ?? {} as ServiceConfig;
			const endpointConfig = registryConfig?.endpoints?.deregister ?? {} as EndPointConfig;
			
			expectedUrl = registryConfig.baseURL.href + endpointConfig?.path;
			expectedBody = <RegistryServiceDataDTO>{
				serviceId: appConfig.serviceid,
				serviceName: appConfig.servicename,
				location: appConfig.baseURL.href
			};		
			expectedConfig = {
				headers: {
					authorization: `Bearer ${accesstoken}`
				}
			};
		});

		it('can deregister this service from the microservice registry', async () => {
			await service.deregister();
			expect(httpPostSpy).toHaveBeenCalledTimes(1);
			expect(httpPostSpy).toHaveBeenCalledWith(expectedUrl, expectedBody, expectedConfig);
		});

		it('fails if the request to the microservice registry fails', async () => {
			httpPostSpy.mockImplementationOnce(() => { throw new Error('test error') });
			await expect(service.deregister()).rejects.toThrow();
		});

		it('fails if the response status code is not 200 (i.e. OK)', async () => {
			httpPostSpy.mockImplementationOnce(() => of({ data: false, status: 500 }) as any);
			await expect(service.deregister()).rejects.toThrow();
		});
	});

	describe('register', () => {
		let expectedUrl: string;
		let expectedBody: RegistryServiceDataDTO;
		let expectedConfig: any;
		beforeEach(() => {
			const appConfig = config.get<AppConfig>('app') ?? {} as AppConfig;
			const registryConfig = config.get<ServiceConfig>(`services.${registryServiceName}`) ?? {} as ServiceConfig;
			const endpointConfig = registryConfig?.endpoints?.register ?? {} as EndPointConfig;
			
			expectedUrl = registryConfig.baseURL.href + endpointConfig?.path;
			expectedBody = <RegistryServiceDataDTO>{
				serviceId: appConfig.serviceid,
				serviceName: appConfig.servicename,
				location: appConfig.baseURL.href
			};		
			expectedConfig = {
				headers: {
					authorization: `Bearer ${accesstoken}`
				}
			};
		});

		it('can register this service with the microservice registry', async () => {
			await service.register();
			expect(httpPostSpy).toHaveBeenCalledTimes(1);
			expect(httpPostSpy).toHaveBeenCalledWith(expectedUrl, expectedBody, expectedConfig);
		});

		it('fails if the request to the microservice registry fails', async () => {
			httpPostSpy.mockImplementationOnce(() => { throw new Error('test error') });
			await expect(service.register()).rejects.toThrow();
		});

		it('fails if the response status code is not 200 (i.e. OK)', async () => {
			httpPostSpy.mockImplementationOnce(() => of({ data: false, status: 500 }) as any);
			await expect(service.register()).rejects.toThrow();
		});
	});

	describe('Logging API', () => {
		describe('LoggableMixin Members', () => {
			it('inherits log$', () => {
				expect(service.log$).toBeDefined();
				expect(service.log$).toBeInstanceOf(Subject);
			});

			it('inherits logger', () => {
				expect(service.logger).toBeDefined();
				expect(service.logger).toBeInstanceOf(StreamLogger);
			});

			it('inherits logToStream', () => {
				expect(service.logToStream).toBeDefined();
				expect(typeof service.logToStream).toBe('function');
			});
		});
	});
});