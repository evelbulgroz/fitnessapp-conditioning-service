import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TestingModule } from '@nestjs/testing';


import { lastValueFrom, of } from 'rxjs';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { v4 as uuid } from 'uuid';

import { ConsoleLogger, Logger, Result } from '@evelbulgroz/ddd-base';

import AppInstance from './app-instance.model';
import BcryptCryptoService from '../authentication/services/crypto/bcrypt-crypto.service';
import createTestingModule from '../test/test-utils';
import CryptoService from '../authentication/services/crypto/domain/crypto-service.model';
import JwtAuthGuard from '../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from '../authentication/services/jwt/jwt-secret.service';
import JwtService from '../authentication/services/jwt/domain/jwt-service.model';
import JsonWebtokenService from '../authentication/services/jwt/json-webtoken.service';
import RolesGuard from '../infrastructure/guards/roles.guard';
import SwaggerController from './swagger.controller';
import UserRepository from '../user/repositories/user.repo';
import ValidationPipe from '../infrastructure/pipes/validation.pipe';
import UserJwtPayload from '../authentication/services/jwt/domain/user-jwt-payload.model';
import UserContext, { UserContextProps } from '../shared/domain/user-context.model';

//process.env.NODE_ENV = 'not test'; // ConsoleLogger will not log to console if NODE_ENV is set to 'test'

// NOTE:
  // Testing over http to enable decorators and guards without having to do a ton of additional setup/mocking.
  // This also ensures request/response objects are correctly formatted and that the controller is correctly configured.
  // This is a bit of a hack, but it works for now. Clean up later when setting up e2e tests.

jest.mock('swagger-ui-dist', () => ({
	getAbsoluteFSPath: jest.fn(() => '/mock/path/to/swagger-ui-dist'),
}));

jest.mock('fs', () => ({
	...jest.requireActual('fs'),
	// Mock the readFileSync function to return a specific value for testing
	readFileSync: jest.fn((path: string) => {
		if (path.includes('swagger-initializer.js')) {
			return 'window.onload = function() { spec: {} };';
		}
		if (path.includes('index.html')) {
			return '<html>Mock Swagger UI</html>';
		}
		return '';
	}),
}));

describe('SwaggerController', () => {
	let app: INestApplication;
	let appInstanceSpy: any;
	let baseUrl: string;
	let config: ConfigService;
	let controller: SwaggerController;
	let crypto: CryptoService;
	let http: HttpService;
	let jwt: JwtService;
	let mockResponse: Partial<Response>;
	let userRepo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule, // implicitly imports HttpService, adding service to providers array causes error
			],
			controllers: [ SwaggerController ],
			providers: [
				{ // AppInstance
					provide: AppInstance,
					useValue: {
						getAppInstance: jest.fn(),
					},
				},
				{ // CryptoService
					provide: CryptoService,
					useClass: BcryptCryptoService,
				},
				{ // JwtAuthGuard
					provide: JwtAuthGuard,
					useValue: jest.fn(),
				},
				{ // JwtSecretService
					provide: JwtSecretService,
					useFactory: (configService: ConfigService) => {
						const secret = configService.get<string>('security.authentication.jwt.accessToken.secret')!;
						return new JwtSecretService(secret);
					},
					inject: [ConfigService],
				},
				{ // JwtService
					provide: JwtService,
					useFactory: (secretService: JwtSecretService) => {
						return new JsonWebtokenService(secretService);
					},
					inject: [JwtSecretService],
				},
				JwtAuthStrategy, // mostly for internal use by JwtAuthGuard, but simpler to provide here
				{ // Logger
					provide: Logger,
					useClass: ConsoleLogger,
				},
				{ //RolesGuard
					provide: RolesGuard,
					useValue: jest.fn(),
				},
				Reflector, // used by RolesGuard
				{ // User repository
					provide: UserRepository,
					useValue: {
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
					}
				},
			],
		}))
		.compile();
		
		app = module.createNestApplication();
		appInstanceSpy = jest.spyOn(AppInstance, 'getAppInstance').mockImplementation(() => app); // not otherwise initialized in test
		config = module.get<ConfigService>(ConfigService);
		controller = module.get<SwaggerController>(SwaggerController);
		crypto = module.get<CryptoService>(CryptoService);
		http = module.get<HttpService>(HttpService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository>(UserRepository);
		
		app.useGlobalPipes(new ValidationPipe());
		await app.init();
		await app.listen(0);
		
		const port = app?.getHttpServer()?.address()?.port; // random port, e.g. 60703
		baseUrl = `http://localhost:${port}/docs`; // prefix not applied during testing, so omit it

		mockResponse = {
			setHeader: jest.fn(),
			send: jest.fn(),
		};
	});

	let adminAccessToken: string;
	let adminPayload: UserJwtPayload;
	let adminProps: UserContextProps;
	let adminUserContext: UserContext;
	let headers: any;
	let userRepoSpy: any;
	beforeEach(async () => {
		adminProps = {
			userId: uuid(),
			userName: 'adminuser',
			userType: 'user',
			roles: ['admin'],
		};

		adminPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: adminProps.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			//exp: Math.floor(new Date('2100-01-01').getTime() / 1000), // far in the future (for manual testing)
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: adminProps.userName,
			subType: adminProps.userType as any,
			roles: adminProps.roles,
		};	
		//console.debug('adminPayload:', adminPayload);

		adminAccessToken = await jwt.sign(adminPayload);	
		adminUserContext = new UserContext({ ...adminProps });	
		headers = { Authorization: `Bearer ${adminAccessToken}` };	
		userRepoSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => Promise.resolve(Result.ok(of({entityId: adminUserContext.userId} as any))));
	});

	afterEach(() => {
		app.close();
		appInstanceSpy && appInstanceSpy.mockRestore();
		userRepoSpy && userRepoSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(controller).toBeDefined();
	});

	describe('Endpoints', () => {
		describe('docs', () => {
			it('serves Swagger UI HTML', async () => {
				// arrange
				const url = `${baseUrl}`;
				
				// act
				const response = await lastValueFrom(http.get(url, { headers }));
				
				// assert
				expect(response.status).toBe(200);
				expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
				expect(response.data?.length).toBeGreaterThan(0);
				expect(response.data).toContain('<html>Mock Swagger UI</html>');
			});
		});

		describe('docs/json', () => {
			it('generates and serves Swagger JSON', async () => {
				// arrange
				const url = `${baseUrl}/json`;
				const expectedSwaggerJson = {
					"openapi": "3.0.0",
					"paths": {
						"/docs": {
						"get": {
							"operationId": "SwaggerController_serveSwaggerUI",
							"parameters": [],
							"responses": {
							"200": {
								"description": ""
							}
							},
							"tags": [
							"Swagger"
							]
						}
						},
						"/docs/json": {
						"get": {
							"operationId": "SwaggerController_serveSwaggerJson",
							"parameters": [],
							"responses": {
							"200": {
								"description": ""
							}
							},
							"tags": [
							"Swagger"
							]
						}
						}
					},
					"info": {
						"title": "FitnessApp Conditioning Service API",
						"description": "API documentation for FitnessApp Conditioning Service",
						"version": "0.0.1",
						"contact": {}
					},
					"tags": [],
					"servers": [],
					"components": {
						"schemas": {}
					}
				};
				
				// act
				const response = await lastValueFrom(http.get(url, { headers }));
				
				// assert
				expect(response.status).toBe(200);
				expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
				expect(typeof response.data).toBe('object');
				expect(response.data).toEqual(expectedSwaggerJson);
			});
		});
	});
});