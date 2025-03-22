import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TestingModule } from '@nestjs/testing';

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

import ServiceDataDTOProps from '../../dtos/responses/service-data.dto';
import BootstrapResponseDTO from '../../dtos/responses/bootstrap-response.dto';
import ServiceLoginDataDTO from '../../dtos/requests/service-login-data.dto';
import ServiceLogoutDataDTO from '../../dtos/requests/service-logout-data.dto';
import ServiceTokenRefreshDataDTO from '../../dtos/requests/service-token-refresh-data.dto';

import { AppConfig, EndPointConfig, ServiceConfig } from '../../../shared/domain/config-options.model';
import createTestingModule from '../../../test/test-utils';
import TokenService from './token.service';

//process.env.NODE_ENV = 'not-test'; // set NODE_ENV to not-test to enable logging

describe('TokenService', () => {
	let config: ConfigService;
	let httpService: HttpService;
	let service: TokenService;	
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			imports: [
				//ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				{
					provide: HttpService,
					useValue: {
						get: jest.fn(),
						post: jest.fn()
					},
				},
				ConfigService,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},
				TokenService,
			],
		}))
		.compile();

		config = module.get<ConfigService>(ConfigService);
		httpService = module.get<HttpService>(HttpService);
		service = module.get<TokenService>(TokenService);
	});

	let accessToken: string;
	let accessToken2: string;
	let authServiceDataProps: ServiceDataDTOProps;
	let bootstrapData: BootstrapResponseDTO;
	let httpGetSpy: any;
	let httpPostSpy: any;
	let refreshToken: string;
	let serviceName: string;
	let verificationToken: string;
	beforeEach(() => {
		serviceName = 'fitnessapp-conditioning-service';
		const jwtConfig = config.get(`security.authentication.jwt`) ?? {};
		
		accessToken = jwt.sign({ serviceName }, jwtConfig.accessToken.secret, { expiresIn: '1h' });
		accessToken2 = jwt.sign({ serviceName }, jwtConfig.accessToken.secret, { expiresIn: '1h' });
		refreshToken = jwt.sign({ serviceName }, jwtConfig.refreshToken.secret, { expiresIn: '7d' });
		verificationToken = 'test.verification.token';

		authServiceDataProps = new ServiceDataDTOProps({
			location: 'https://localhost:3010/auth/api/v1',
			serviceId: uuidv4(),
			serviceName: 'fitnessapp-authentication-service',
		});
	
		bootstrapData = new BootstrapResponseDTO({
			verificationToken,
			authServiceData: authServiceDataProps
		});		
		
		httpGetSpy = jest.spyOn(httpService, 'get')
			.mockImplementation((url: string, config: any) => {
				if (url.includes('registry')) {
					if(url.includes('bootstrap')) {
						return of({ data: bootstrapData, status: 200 }) as any;
					}
				}
				else if (url.includes('auth') && url.includes('register')) {
					return of({ data: { accessToken, refreshToken, status: 200 } }) as any;
				}
			})
		
		httpPostSpy = jest.spyOn(httpService, 'post')
			.mockImplementation((url: string, body: any, config: any) => {
				if (url.includes('registry')) {
					if (url.includes('locate')) {
						const serviceName = body?.targetServiceName;
						return of({ data: authServiceDataProps, status: 200 }) as any;
					}					
					else if (url.includes('register')) {
						return of({ data: true, status: 200 }) as any;
					}
					else if (url.includes('verify')) {
						return of({ data: true, status: 200 }) as any;
					}					
				}
				else if (url.includes('auth')) {
					if (url.includes('service/login')) {
						return of({ data: { accessToken, refreshToken }, status: 200 }) as any;
					}
					else if (url.includes('service/logout')) {
						return of({ data: 'Service logged out', status: 200 }) as any;
					}
					else if (url.includes('service/refresh')) {
						return of({ data: { accessToken: accessToken2 }, status: 200 }) as any;
					}
				}
			});			
	});

	afterEach(() => {
		httpGetSpy && httpGetSpy.mockRestore();
		httpPostSpy && httpPostSpy.mockRestore();
	});	

	describe('public API', () => {
		it('can be created', () => {
			expect(service).toBeDefined();
		});

		describe('auth data', () => {	
			let bootstrapUrl: string;
			let loginUrl: string;

			beforeEach(() => {
				const appConfig = config.get('app') ?? {} as AppConfig;
				const registryConfig = config.get('services.fitnessapp-registry-service') ?? {} as ServiceConfig;			
				const bootstrapConfig = registryConfig?.endpoints?.bootstrap ?? {} as EndPointConfig;
				bootstrapUrl = registryConfig?.baseURL.href + bootstrapConfig.path + '/' + appConfig.servicename;

				const authConfig = config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;			
				const loginConfig = authConfig?.endpoints?.serviceLogin ?? {} as EndPointConfig;				
				loginUrl = bootstrapData.authServiceData?.location + loginConfig.path;				
			});
			
			it('can get auth data as JWT access token', async () => {
				// arrange
				
				//act
				const token = await service.getAuthData();

				// assert
				expect(httpGetSpy).toHaveBeenCalledTimes(1);
				expect(token).toBe(accessToken);			
			});

			it('initiates token acquisition if auth data is not available', async () => {
				// arrange
				service['_accessToken'] = undefined; // sanity check

				//act
				void await service.getAuthData();

				// assert
				expect(httpGetSpy).toHaveBeenCalledTimes(1);
				const getUrl = httpGetSpy.mock.calls[0][0];
				expect(getUrl).toBe(bootstrapUrl);

				expect(httpPostSpy).toHaveBeenCalledTimes(1);
				const postUrl = httpPostSpy.mock.calls[0][0];
				expect(postUrl).toBe(loginUrl);

				expect(service['_accessToken']).toBe(accessToken);
			});

			it('fails if token acquisition fails', async () => {
				// arrange
				httpGetSpy && httpGetSpy.mockRestore();
				httpGetSpy.mockImplementationOnce(() => { throw new Error('test error') });

				//act/assert
				expect(() => service.getAuthData()).rejects.toThrow();
			});

			it('initiates token refresh if access token has expired', async () => {
				// arrange
				service['_accessToken'] = accessToken; // sanity check
				const jwtConfig = config.get(`security.authentication.jwt`) ?? {};
				const expiredToken = jwt.sign({ serviceName }, jwtConfig.accessToken.secret, { expiresIn: '0s' });
				service['_accessToken'] = expiredToken; // sanity check

				//act
				const token = await service.getAuthData();

				// assert
				expect(httpGetSpy).toHaveBeenCalledTimes(1);
				expect(httpPostSpy).toHaveBeenCalledTimes(1);
				expect(token).toBe(accessToken);
			});

			it('initiates re-login if refresh token has expired', async () => {
				// arrange
				const jwtConfig = config.get(`security.authentication.jwt`) ?? {};
				const expiredAccessToken = jwt.sign({ serviceName }, jwtConfig.accessToken.secret, { expiresIn: '0s' });
				service['_accessToken'] = expiredAccessToken; // set expired token, should trigger refresh
				const expiredRefreshToken = jwt.sign({ serviceName }, jwtConfig.refreshToken.secret, { expiresIn: '0s' });
				service['_refreshToken'] = expiredRefreshToken; // set expired token, should trigger re-authentication

				//act
				const token = await service.getAuthData();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(2);
				expect(token).toBe(accessToken);
			});
		});

		describe('login', () => {
			// NOTE: Just test that the call goes through: login is fully tested with getAuthData method
			it('can log in to the authentication microservice', async () => {
				// arrange
				
				//act
				const result = await service.login();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(1);
				expect(result).toEqual({ accessToken, refreshToken });
			});
		});

		describe('logout', () => {
			let logoutUrl: string;
			let logoutData: ServiceTokenRefreshDataDTO;
			let logoutHeaders: any;
			beforeEach(() => {
				const appConfig = config.get('app') ?? {} as AppConfig;
				const authConfig = config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;			
				const logoutConfig = authConfig?.endpoints?.serviceLogout ?? {} as EndPointConfig;
				
				logoutUrl = bootstrapData.authServiceData?.location + logoutConfig.path;
				logoutData = <ServiceLogoutDataDTO> {
					serviceId: appConfig.serviceid,
					serviceName: appConfig.servicename,
					refreshToken
				};
				logoutHeaders = {
					headers: {
						authorization: `Bearer ${accessToken}`
					}
				};
			});

			it('can log out from the authentication microservice', async () => {
				// arrange
				
				//act
				const result = await service.logout();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(3);
				expect(httpPostSpy).toHaveBeenCalledWith(logoutUrl, logoutData, logoutHeaders);
				expect(result).toBe('TokenService.logout Service logged out successfully');
			});

			it('clears access and refresh tokens after logging out', async () => {
				// arrange
				service['_accessToken'] = accessToken; // populate tokens
				service['_refreshToken'] = refreshToken;

				//act
				void await service.logout();

				// assert
				expect(service['_accessToken']).toBeUndefined();
				expect(service['_refreshToken']).toBeUndefined();
			});

			it('fails if logout request fails', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => { throw new Error('test error') });

				//act/assert
				expect(() => service.logout()).rejects.toThrow();
			});

			it('fails if the response status code is not 200 (i.e. OK)', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ status: 500 }) as any);

				//act/assert
				expect(() => service.logout()).rejects.toThrow();
			});
		});
	});
	
	describe('internals', () => {
		describe('log in', () => {
			it('orchestrates token acquisition and returns tokens', async () => {
				// arrange
				expect(service['_accessToken']).toBeUndefined(); // sanity checks
				expect(service['_refreshToken']).toBeUndefined();

				//act
				const {accessToken, refreshToken} = await service['login']();

				// assert
				expect(accessToken).toBe(accessToken);
				expect(refreshToken).toBe(refreshToken);

				expect(service['_accessToken']).toBe(accessToken);
				expect(service['_refreshToken']).toBe(refreshToken);
			});

			it('stores access and refresh tokens', async () => {
				// arrange
				expect(service['_accessToken']).toBeUndefined(); // sanity checks
				expect(service['_refreshToken']).toBeUndefined();

				//act
				void await service['login']();

				// assert
				expect(service['_accessToken']).toBe(accessToken);
				expect(service['_refreshToken']).toBe(refreshToken);
			});
		});

		describe('bootstrap', () => {
			let url: string;
			let options: any;

			beforeEach(() => {
				const appConfig = config.get('app') ?? {} as AppConfig;
				const registryConfig = config.get('services.fitnessapp-registry-service') ?? {} as ServiceConfig;			
				const bootstrapConfig = registryConfig?.endpoints?.bootstrap ?? {} as EndPointConfig;
				const sharedSecret = config.get('security.verification.bootstrap.secret') ?? '';
				
				url = registryConfig?.baseURL.href + bootstrapConfig.path + '/' + appConfig.servicename;
				options = {
					headers: {
						authorization: `Bearer ${sharedSecret}`
					}
				};
			});

			it('acquires a verification token from the microservice registry using a shared secret', async () => {
				// arrange		
				
				//act
				const data = await service['bootstrap']();

				// assert
				expect(httpGetSpy).toHaveBeenCalledTimes(1);
				expect(httpGetSpy).toHaveBeenCalledWith(url, options);
				expect(data).toBeDefined();
				expect(data.verificationToken).toBe(verificationToken);
			});
			
			it('acquires active auth microservice endpoint information from the microservice registry', async () => {
				// arrange		
				
				//act
				const data = await service['bootstrap']();

				// assert
				expect(httpGetSpy).toHaveBeenCalledTimes(1);
				expect(httpGetSpy).toHaveBeenCalledWith(url, options);
				expect(data).toBeDefined();
				expect(data.authServiceData).toEqual(bootstrapData.authServiceData);
			});

			it('fails if the request to the microservice registry fails', async () => {
				// arrange
				httpGetSpy && httpGetSpy.mockRestore();
				httpGetSpy.mockImplementationOnce(() => { throw new Error('test error') });

				//act/assert
				expect(() => service['bootstrap']()).rejects.toThrow();
			});

			it('fails if the response status code is not 200 (i.e. OK)', async () => {
				// arrange
				httpGetSpy && httpGetSpy.mockRestore();
				httpGetSpy.mockImplementationOnce(() => of({ status: 500 }) as any);

				//act/assert
				expect(() => service['bootstrap']()).rejects.toThrow();
			});
			
			it('fails if the verification token is not received', async () => {
				// arrange
				httpGetSpy && httpGetSpy.mockRestore();
				httpGetSpy.mockImplementationOnce(() => of({ data: { authServiceData: bootstrapData.authServiceData }, status: 200 }) as any);

				//act/assert
				expect(() => service['bootstrap']()).rejects.toThrow();
			});
			
			it('fails if auth microservice endpoint information is not received', async () => {
				// arrange
				httpGetSpy && httpGetSpy.mockRestore();
				httpGetSpy.mockImplementationOnce(() => of({ data: { verificationToken }, status: 200 }) as any);

				//act/assert
				expect(() => service['bootstrap']()).rejects.toThrow();
			});

			it('fails if auth service endpoint information is incomplete', async () => {
				// arrange
				httpGetSpy && httpGetSpy.mockRestore();
				httpGetSpy.mockImplementationOnce(() => of({ data: { verificationToken, authServiceData: { serviceName: 'fitnessapp-authentication-service' } }, status: 200 }) as any);

				//act/assert
				expect(() => service['bootstrap']()).rejects.toThrow();
			});
		});

		describe('authenticate', () => {
			let url: string;
			let body: any;
			let options: any;
			beforeEach(() => {
				const appConfig = config.get('app') ?? {} as AppConfig;
				const authConfig = config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;			
				const loginConfig = authConfig?.endpoints?.serviceLogin ?? {} as EndPointConfig;
				const password = config.get('security.authentication.app.password') ?? '';
				
				url = bootstrapData.authServiceData?.location + loginConfig.path;
				body = <ServiceLoginDataDTO>{
					password,
					serviceId: appConfig?.serviceid,
					serviceName: appConfig?.servicename,
					verificationToken: bootstrapData?.verificationToken
				};;
				options = {
					headers: {
						authorization: `Bearer ${password}`
					}
				};
			});		
			
			it('acquires access and refresh tokens from the auth microservice using verification token and credentials', async () => {
				// arrange		
				
				//act
				const data = await service['authenticate'](bootstrapData);

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(1);
				expect(httpPostSpy).toHaveBeenCalledWith(url, body, options);
				expect(data).toBeDefined();
				expect(data.accessToken).toBe(accessToken);
				expect(data.refreshToken).toBe(refreshToken);
			});		
			
			it('fails if the request to the authentication microservice fails', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => { throw new Error('test error') });

				//act/assert
				expect(() => service['authenticate'](bootstrapData)).rejects.toThrow();
			});

			it('fails if the response status code is not 200 (i.e. OK)', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ status: 500 }) as any);

				//act/assert
				expect(() => service['authenticate'](bootstrapData)).rejects.toThrow();
			});
			
			it('fails if the access token is not received', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ data: { refreshToken }, status: 200 }) as any);

				//act/assert
				expect(() => service['authenticate'](bootstrapData)).rejects.toThrow();
			});

			it('fails if the access token is invalid', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ data: { accessToken: 'invalid-token', refreshToken }, status: 200 }) as any);

				//act/assert
				expect(() => service['authenticate'](bootstrapData)).rejects.toThrow();
			});

			it('fails if the refresh token is not received', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ data: { accessToken }, status: 200 }) as any);

				//act/assert
				expect(() => service['authenticate'](bootstrapData)).rejects.toThrow();
			});
				
			it('fails if the refresh token is invalid', async () => {
				// arrange
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ data: { accessToken, refreshToken: 'invalid-token' }, status: 200 }) as any);

				//act/assert
				expect(() => service['authenticate'](bootstrapData)).rejects.toThrow();
			});
		});
		
		describe('token refresh', () => {
			let expectedUrl: string;
			let expectedBody: any;
			let expectedOptions: any;
			let expiredToken: string;
			beforeEach(async () => {
				service['_accessToken'] = accessToken; // set access token, without causing http call intercepted by spy
				service['_refreshToken'] = refreshToken; // set refresh token, without causing http call intercepted by spy

				const appConfig = config.get('app') ?? {} as AppConfig;
				const authServiceConfig = config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;
				const refreshConfig = authServiceConfig?.endpoints?.serviceRefresh ?? {} as EndPointConfig;		
				
				const tokenSecret = config.get(`security.authentication.jwt.accessToken.secret`) ?? '';
				expiredToken = jwt.sign({ serviceName }, tokenSecret, { expiresIn: '0s' });
				
				expectedUrl = authServiceConfig.baseURL.href + refreshConfig.path;		
				expectedBody = <ServiceTokenRefreshDataDTO>{
					serviceId: appConfig.serviceid,
					serviceName: appConfig.servicename,
					refreshToken // note: this presumes a bug fix in the auth service DTO
				};		
				expectedOptions = {
					headers: {
						authorization: `Bearer ${service['_refreshToken']}` // note: this presumes a bug fix in the auth service
					}
				};
			});
			
			it('refreshes the access token with the auth microservice, using the refresh token', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh

				//act
				const token = await service.getAuthData();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(2); // 1 login, 1 refresh
				expect(httpPostSpy).toHaveBeenNthCalledWith(2, expectedUrl, expectedBody, expectedOptions);
				expect(token).toBe(accessToken2);
			});

			it('triggers refresh if access token is expired when requested', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh

				//act
				const token = await service.getAuthData();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(2); // 1 login, 1 refresh
				expect(httpPostSpy).toHaveBeenNthCalledWith(2, expectedUrl, expectedBody, expectedOptions);
				expect(token).toBe(accessToken2);
			});

			it('does not trigger refresh if access token is valid when requested', async () => {
				// arrange
				 // leave access token as is

				//act
				const token = await service.getAuthData();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(0);
				expect(token).toBe(accessToken); // i.e. original token
			});

			it('fails if the refresh request fails', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => { throw new Error('test error') });

				//act/assert
				expect(() => service.getAuthData()).rejects.toThrow();
			});

			it('fails if the response status code is not 200 (i.e. OK)', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ status: 500 }) as any);

				//act/assert
				expect(() => service.getAuthData()).rejects.toThrow();
			});

			it('fails if the access token is not received', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ data: { }, status: 200 }) as any);

				//act/assert
				expect(() => service.getAuthData()).rejects.toThrow();
			});

			it('fails if the access token is invalid', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh
				httpPostSpy && httpPostSpy.mockRestore();
				httpPostSpy.mockImplementationOnce(() => of({ data: { accessToken: 'invalid-token' }, status: 200 }) as any);

				//act/assert
				expect(() => service.getAuthData()).rejects.toThrow();
			});
			
			it('re-authenticates if the refresh token has also expired', async () => {
				// NOTE: Just test that the re-authentication is triggered, the actual authentication process is fully tested elsewhere
				
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh
				service['_refreshToken'] = expiredToken; // set expired token, should trigger re-authentication

				const authServiceConfig = config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;
				const refreshConfig = authServiceConfig?.endpoints?.serviceRefresh ?? {} as EndPointConfig;		
				const expectedUrl = authServiceConfig.baseURL.href + refreshConfig.path;		

				//act
				const token = await service.getAuthData();

				// assert
				expect(httpPostSpy).toHaveBeenCalledTimes(2); // 1 login, 1 refresh
				const url = httpPostSpy.mock.calls[1][0];
				expect(url).toBe(expectedUrl);
				
				expect(token).toBe(accessToken);
			});
			
			it('prevents concurrent requests from initiating overlapping login attempts', async () => {
				// arrange
				service['_accessToken'] = undefined; // set undefined token, should trigger login

				//act
				const promises = [service.getAuthData(), service.getAuthData(), service.getAuthData()];

				// assert
				await Promise.all(promises);
				expect(httpPostSpy).toHaveBeenCalledTimes(1); // 1 login
			});
			
			it('prevents concurrent requests from initiating overlapping refresh attempts', async () => {
				// arrange
				service['_accessToken'] = expiredToken; // set expired token, should trigger refresh

				//act
				const promises = [service.getAuthData(), service.getAuthData(), service.getAuthData()];

				// assert
				await Promise.all(promises);
				expect(httpPostSpy).toHaveBeenCalledTimes(2); // 1 login, 1 refresh
			});
		});
	});	
});