import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { Logger }  from '@evelbulgroz/logger';

import { jest } from '@jest/globals';

import AppModule from './app.module';
import AuthService from './authentication/domain/auth-service.class';
import createTestingModule from './test/test-utils';
import EventDispatcherService from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import RegistrationService from './authentication/services/registration/registration.service';
import RetryHttpService from './shared/services/utils/retry-http/retry-http.service';
import SwaggerController from './api-docs/swagger.controller';
import TokenService from './authentication/services/token/token.service';
import UserController from './user/controllers/user.controller';
import UserRepository from './user/repositories/user.repo';

describe('AppModule', () => {
	let appModule: AppModule;	
	let authService: AuthService;
	let registrationService: RegistrationService;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
				AppModule
			],
			providers: [
				{ // AuthService mock
					provide: AuthService,
					useValue: {
						getAuthData: jest.fn()	
					},
				},
				{ // ConditioningController mock
					provide: 'ConditioningController',
					useValue: {
						// Mock methods as needed
					},
				},
				ConfigService,
				{ // EventDispatcherService mock
					provide: EventDispatcherService,
					useValue: {
						dispatchEvent: jest.fn(),
					},
				},
				{ // HttpService mock
					provide: HttpService,
					useValue: {
						get: jest.fn(),
						post: jest.fn()
					},
				},
				{ // Logger mock (suppress console output)
					provide: Logger,
					useValue: {
						log: jest.fn(),
						error: jest.fn(),
						warn: jest.fn(),
						debug: jest.fn(),
						verbose: jest.fn(),
					},
				},
				{ // RegistrationService mock
					provide: RegistrationService,
					useValue: {
						register: jest.fn(),
						deregister: jest.fn(),
					},
				},
				{ // RetryHttpService mock
					provide: RetryHttpService,
					useValue: {
						get: jest.fn(),
						post: jest.fn(),
					},
				},
				{ // SwaggerController mock
					provide: SwaggerController,
					useValue: {
						// Mock methods as needed					
					}
				},
				{ // TokenService mock
					provide: TokenService,
					useValue: {
						getAuthData: jest.fn(),
						logout: jest.fn(),
					},
				},
				{ // UserController mock
					provide: UserController,
					useValue: {
						isReady: jest.fn(),
					},
				},
			],
		}))
		.compile();

		const userRepo = module.get<UserRepository>(UserRepository);
		console.debug('userRepo', userRepo); // bug: returns UserRepository instance, but not the mock implementation
		appModule = module.get<AppModule>(AppModule);
		authService = module.get<AuthService>(AuthService);
		registrationService = module.get<RegistrationService>(RegistrationService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(appModule).toBeDefined();
	});

	describe('Server initialization - onModuleInit', () => {
		let accessToken: string;
		let registrationSpy: any;
		let tokenServiceSpy: any;

		beforeEach(() => {
			accessToken = 'test-access-token';
			registrationSpy = jest.spyOn(registrationService, 'register');//.mockImplementation(() => Promise.resolve(true));
			tokenServiceSpy = jest.spyOn(authService, 'getAuthData');//.mockImplementation(() => Promise.resolve(accessToken));
		});

		afterEach(() => {
			registrationSpy && registrationSpy.mockRestore();
			tokenServiceSpy && tokenServiceSpy.mockRestore();
		});

		describe('Authentication', () => {
			it('logs in to the authentication microservice', async () => {
				// arrange
				
				// act
				await appModule.onModuleInit();

				// assert
				expect(tokenServiceSpy).toHaveBeenCalledTimes(1);
			});

			it('fails if login fails', async () => {
				// arrange
				tokenServiceSpy.mockImplementation(() => Promise.reject('test-error'));
				
				// act
				await expect(appModule.onModuleInit()).rejects.toThrow();
			});
		});

		describe('Registration', () => {
			it('registers with the registry service', async () => {
				// arrange
				
				// act
				await appModule.onModuleInit();

				// assert
				expect(registrationSpy).toHaveBeenCalledTimes(1);
			});

			it('fails if registration fails', async () => {
				// arrange
				registrationSpy.mockImplementation(() => Promise.reject('test-error'));
				
				// act
				await expect(appModule.onModuleInit()).rejects.toThrow();
			});
		});
	});

	describe('Server shutdown - onModuleDestroy', () => {
		let deregistrationSpy: any;
		let logoutSpy: any;
		beforeEach(() => {
			deregistrationSpy = jest.spyOn(registrationService, 'deregister').mockImplementation(() => Promise.resolve(true));
			logoutSpy = jest.spyOn(authService, 'logout').mockImplementation(() => Promise.resolve('Service logout successful'));
		});

		afterEach(() => {
			deregistrationSpy && deregistrationSpy.mockRestore();
		});

		describe('Deregistration', () => {		
			it('deregisters from the registry service', async () => {
				// arrange

				// act
				await appModule.onModuleDestroy();

				// assert
				expect(deregistrationSpy).toHaveBeenCalledTimes(1);
			});

			it('fails if deregistration fails', async () => {
				// arrange
				deregistrationSpy.mockImplementation(() => Promise.reject('test-error'));
				
				// act
				await expect(appModule.onModuleDestroy()).rejects.toThrow();
			});
		});

		describe('Logout', () => {
			it('logs out of the authentication microservice', async () => {
				// arrange

				// act
				await appModule.onModuleDestroy();

				// assert
				expect(logoutSpy).toHaveBeenCalledTimes(1);
			});

			it('fails if logout fails', async () => {
				// arrange
				logoutSpy.mockImplementation(() => Promise.reject('test-error'));
				
				// act
				await expect(appModule.onModuleDestroy()).rejects.toThrow();

				// assert
				expect(logoutSpy).toHaveBeenCalledTimes(1);
			});
		});
	});
});