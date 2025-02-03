import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { HttpService, HttpModule } from '@nestjs/axios';

import { lastValueFrom, of } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { Logger, Result } from '@evelbulgroz/ddd-base';

import { BcryptCryptoService } from '../services/crypto/bcrypt-crypto.service';
import { createTestingModule } from '../test/test-utils';
import { CryptoService } from '../services/crypto/models/crypto-service.model';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';
import { JwtSecretService } from '../services/jwt/jwt-secret.service';
import { JwtService } from "../services/jwt/models/jwt-service.model";
import { JsonWebtokenService } from '../services/jwt/json-webtoken.service';
import { UserContext, UserContextProps } from '../domain/user-context.model';
import { UserController } from './user.controller';
import { UserJwtPayload } from '../services/jwt/models/user-jwt-payload.model';
import { UserRepository } from '../repositories/user.repo';
import { UserService } from '../services/user/user.service';
import { ValidationPipe } from './pipes/validation.pipe';

describe('UserController', () => {
  	let app: INestApplication;
	let controller: UserController;
	let userDataService: UserService;
	let config: ConfigService;
	let crypto: CryptoService;
	let http: HttpService;
	let jwt: JwtService;
	let baseUrl: string;
	let userRepo: UserRepository;
	beforeEach(async () => {
		const module: TestingModule = await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			imports: [
				HttpModule, // implicitly imports HttpService, adding service to providers array causes error
			],
			controllers: [UserController],
			providers: [
				ConfigService,
				{ // CryptoService
					provide: CryptoService,
					useClass: BcryptCryptoService,
				},
				{ // JwtAuthGuard
					provide: JwtAuthGuard,
					useValue: {
						canActivate: jest.fn(),
					},
				},
				JwtAuthStrategy, // mostly for internal use by JwtAuthGuard, but simpler to provide here
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
				{ // Logger
					provide: Logger,
					useValue: {
						log: jest.fn(),
						error: jest.fn(),
					}
				},
				{ // Data service
					provide: UserService,
					useValue: {
						createUser: jest.fn(),
						deleteUser: jest.fn(),
						undeleteUser: jest.fn(),
					},
				},
				{ // User repository
					provide: UserRepository,
					useValue: {
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
					}
				}
			],
		});		
		/*
		.overrideGuard(JwtAuthGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		.overrideGuard(RolesGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		.overrideGuard(LoggingGuard)
		.useValue({ canActivate: jest.fn(() => true) })
		*/
		
		app = module.createNestApplication();
		controller = module.get<UserController>(UserController);
		userDataService = module.get<UserService>(UserService);
		config = module.get<ConfigService>(ConfigService);
		crypto = module.get<CryptoService>(CryptoService);
		http = module.get<HttpService>(HttpService);
		jwt = module.get<JwtService>(JwtService);
		userRepo = module.get<UserRepository>(UserRepository);
  
		app.useGlobalPipes(new ValidationPipe());
		await app.listen(0); // enter 0 to let the OS choose a free port
  
		const port = app.getHttpServer().address().port; // random port, e.g. 60703
		baseUrl = `http://localhost:${port}/user`; // prefix not applied during testing, so omit it
	});
  
	let adminAccessToken: string;
	let adminPayload: UserJwtPayload;
	let adminProps: UserContextProps;
	let userAccessToken: string;
	let headers: any;
	let userContext: UserContext;
	let userPayload: UserJwtPayload;
	let userRepoSpy: any;
	let userMicroServiceName: string;
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
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: adminProps.userName,
			subType: adminProps.userType as any,
			roles: ['admin'],
		};
  
		adminAccessToken = await jwt.sign(adminPayload);
		
		userContext = new UserContext({ 
			userId: uuid(),
			userName: 'testuser',
			userType: 'user',
			roles: ['user'],
		});

		// todo: pass this in token so controller can validate it
		userMicroServiceName = config.get<string>('security.collaborators.user.serviceName')!;
		
		userPayload = { 
			iss: await crypto.hash(config.get<string>('security.authentication.jwt.issuer')!),
			sub: userContext.userId as string,
			aud: await crypto.hash(config.get<string>('app.servicename')!),
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			iat: Math.floor(Date.now() / 1000),
			jti: uuid(),
			subName: userContext.userName,
			subType: userContext.userType,
			roles: ['user'],
		};

		userAccessToken = await jwt.sign(userPayload);

		headers = { Authorization: `Bearer ${userAccessToken}` };
  
		userRepoSpy = jest.spyOn(userRepo, 'fetchById').mockImplementation(() => Promise.resolve(Result.ok(of({entityId: userContext.userId} as any))));
	});
		  
	afterEach(() => {
		app.close();
		userRepoSpy && userRepoSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('can be created', () => {
		expect(controller).toBeDefined();
	});

	describe('Endpoints', () => {
		describe('createUser', () => {
			let requestConfig: any;
			let url: string;
			let userId: string;
			beforeEach(() => {
				requestConfig = { };
				userId = uuid();
				url = `${baseUrl}/${userId}`;
			});

			it('creates a new user and returns an empty success message', async () => {
				// arrange				
				// act
				const response = await lastValueFrom(http.post(url, requestConfig, { headers }));

				// assert
				expect(response.status).toBe(201);
				expect(response.data).toBe('');
			});

			it('throws a BadRequestException if access token is missing', async () => {
				// arrange
				headers = {};
				const response$ = http.post(url, requestConfig, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if access token is invalid', async () => {
				// arrange
				headers = { Authorization: `Bearer invalid` };
				const response$ = http.post(url, requestConfig, headers);

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if requester is not user microservice', async () => { }); // todo: implement

			it('throws if user information in token payload is invalid', async () => {
				// arrange
				userPayload.roles = ['invalid']; // just test that Usercontext is used correctly; it is fully tested elsewhere
				const userAccessToken = await jwt.sign(adminPayload);
				headers = { Authorization: `Bearer ${userAccessToken}` };
				const response$ = http.post(url, requestConfig, { headers } );

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if user id is missing', async () => {
				// arrange
				const response$ = http.post(baseUrl, requestConfig, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if user id is invalid', async () => {
				// arrange
				const response$ = http.post(baseUrl + '/invalid', requestConfig, { headers });

				// act/assert
				expect(async () => await lastValueFrom(response$)).rejects.toThrow();
			});

			it('throws if data service throws', async () => {
				// arrange
				const errorMessage = 'Request failed with status code 400';
				const userServiceSpy = jest.spyOn(userDataService, 'createUser').mockImplementation(() => Promise.reject(new Error(errorMessage)));
				const response$ = http.post(url, requestConfig, { headers });

				// act/assert
				 // jest can't catch errors thrown in async functions, so we have to catch it ourselves
				let error: any;
				let response: any;
				try {
					response = await lastValueFrom(response$);
				}
				catch (e) {
					error = e;					
				}
				expect(error.message).toBe(errorMessage);

				// clean up
				userServiceSpy.mockRestore();
			});
		});
	});
});
