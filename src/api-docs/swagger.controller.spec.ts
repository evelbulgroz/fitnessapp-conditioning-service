import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TestingModule } from '@nestjs/testing';


import { of } from 'rxjs';
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

jest.mock('fs');
jest.mock('path');
jest.mock('./app-instance.model');

describe('SwaggerController', () => {
	let app: INestApplication;
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
				{
					provide: RolesGuard,
					useValue: jest.fn(),
				},
				{
					provide: Reflector,
					useValue: {
						getAllAndOverride: jest.fn(),
					},
				},
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
		userRepoSpy && userRepoSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(controller).toBeDefined();
	});

	describe('serveSwaggerUI', () => {
		it('generates and serves Swagger UI HTML', async () => {
			// Mock dependencies
			const mockAppInstance = {
				getAppInstance: jest.fn().mockReturnValue({}),
			};
			(AppInstance.getAppInstance as jest.Mock).mockReturnValue(mockAppInstance);

			const mockSwaggerHtml = '<html>Mock Swagger UI</html>';
			const mockSwaggerInitializer = 'window.onload = function() { spec: {} };';
			const mockSwaggerUiPath = '/mock/path/to/swagger-ui-dist';

			jest.spyOn(require('swagger-ui-dist'), 'getAbsoluteFSPath').mockReturnValue(mockSwaggerUiPath);
			(readFileSync as jest.Mock)
				.mockImplementationOnce(() => mockSwaggerInitializer) // Mock swagger-initializer.js
				.mockImplementationOnce(() => mockSwaggerHtml); // Mock index.html

			// Call the method
			await controller.serveSwaggerUI(mockResponse as Response);

			// Assertions
			expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
			expect(mockResponse.send).toHaveBeenCalledWith(expect.stringContaining('<html>Mock Swagger UI</html>'));
		});
	});

	describe('serveSwaggerJson', () => {
		it('generates and serves Swagger JSON', async () => {
			// Mock dependencies
			const mockAppInstance = {
				getAppInstance: jest.fn().mockReturnValue({}),
			};
			(AppInstance.getAppInstance as jest.Mock).mockReturnValue(mockAppInstance);

			const mockSwaggerDocument = { openapi: '3.0.0', info: { title: 'Mock API', version: '1.0.0' } };

			jest.spyOn(require('@nestjs/swagger'), 'SwaggerModule').mockImplementation(() => ({
				createDocument: jest.fn().mockReturnValue(mockSwaggerDocument),
			}));

			// Call the method
			await controller.serveSwaggerJson(mockResponse as Response);

			// Assertions
			expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
			expect(mockResponse.send).toHaveBeenCalledWith(mockSwaggerDocument);
		});
	});
});