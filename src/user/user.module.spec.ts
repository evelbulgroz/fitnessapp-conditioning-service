import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { Logger } from '@evelbulgroz/logger';


import JwtAuthGuard from '../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import { UserModule } from './user.module';
import UserController from './controllers/user.controller';
import UserCreatedHandler from './handlers/user-created.handler';
import UserDeletedHandler from './handlers/user-deleted.handler';
import UserRepository from './repositories/user.repo';
import UserDataService from './services/user-data.service';
import UserUpdatedHandler from './handlers/user-updated.handler';

describe('UserModule', () => {
	let module: TestingModule;
	let userModule: UserModule;

	beforeEach(async () => {
		// Create a testing module with mocked dependencies
		module = await Test.createTestingModule({
		  imports: [
			ConfigModule.forRoot({ isGlobal: true }), // Import ConfigModule for ConfigService, required by UserController
			UserModule
		],
		})
		.overrideProvider(ConfigService) // Mock the ConfigService
		.useValue({
		  get: jest.fn((key: string) => {
			switch (key) {
			  case 'modules.user.repos.fs.dataDir':
				return 'test-data-dir';
			  default:
				return null;
			}
		  }),
		})
		.overrideProvider(JwtAuthStrategy) // First, provide the strategy that the guard depends on
		.useValue({
		  validate: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
		  // Add any other methods needed
		})		
		.overrideGuard(JwtAuthGuard) // Then override the guard that uses the strategy (use overrideGuard)
		.useValue({
		  canActivate: jest.fn().mockReturnValue(true),
		})
		.overrideProvider('REPOSITORY_THROTTLETIME')
		.useValue(100)
		.overrideProvider(Logger)
		.useValue({
		  log: jest.fn(),
		  error: jest.fn(),
		  warn: jest.fn(),
		  debug: jest.fn(),
		  verbose: jest.fn(),
		})
		.overrideProvider(PersistenceAdapter)
		.useValue({
		  initialize: jest.fn(),
		  shutdown: jest.fn(),
		  create: jest.fn(),
		  fetchAll: jest.fn(),
		  fetchById: jest.fn(),
		  update: jest.fn(),
		  delete: jest.fn(),
		  undelete: jest.fn(),
		})
		.overrideProvider(UserDataService)
		.useValue({})
		.overrideProvider(UserCreatedHandler)
		.useValue({})
		.overrideProvider(UserDeletedHandler)
		.useValue({})
		.overrideProvider(UserUpdatedHandler)
		.useValue({})
		.overrideProvider(UserRepository)
		.useValue({})
		.overrideProvider(UserController)
		.useValue({
			// Basic mock implementation of controller methods
			createUser: jest.fn(),
			deleteUser: jest.fn(),
			undeleteUser: jest.fn(),
		})
		.compile();
	  
		userModule = module.get<UserModule>(UserModule);
	  });

	afterEach(async () => {
		await module.close();
	});

	it('should be defined', () => {
		expect(userModule).toBeDefined();
		expect(userModule).toBeInstanceOf(UserModule);
	});

	// Add more tests as needed for the module's functionality
});