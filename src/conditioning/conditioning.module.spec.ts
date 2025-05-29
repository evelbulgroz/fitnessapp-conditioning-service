import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { firstValueFrom, Observable, Subject, take } from 'rxjs';

import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { ComponentState, ComponentStateInfo, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { MergedStreamLogger, StreamLogger } from '../libraries/stream-loggable';

import JwtAuthGuard from '../infrastructure/guards/jwt-auth.guard';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import ConditioningController from '../conditioning/controllers/conditioning.controller';
import ConditioningDataService from '../conditioning/services/conditioning-data/conditioning-data.service';
import ConditioningLogCreatedHandler from '../conditioning/handlers/conditioning-log-created.handler';
import ConditioningLogUpdatedHandler from '../conditioning/handlers/conditioning-log-updated.handler';
import ConditioningLogDeletedHandler from '../conditioning/handlers/conditioning-log-deleted.handler';
import ConditioningLogRepository from '../conditioning/repositories/conditioning-log.repo';
import ConditioningModule from './conditioning.module';

// Stand-alone component using the mixin
class TestComponent extends ManagedStatefulComponentMixin(class {}) {
	public initCount = 0;
	public shutdownCount = 0;
	public shouldFailInit = false;
	public shouldFailShutdown = false;
	public initDelay = 0;
	public shutdownDelay = 0;

	public onInitialize(): Promise<void> {
		this.initCount++;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.shouldFailInit) {
					reject(new Error('Initialization failed'));
				} else {
					resolve();
				}
			}, this.initDelay);
		});
	}

	public onShutdown(): Promise<void> {
		this.shutdownCount++;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (this.shouldFailShutdown) {
					reject(new Error('Shutdown failed'));
				} else {
					resolve();
				}
			}, this.shutdownDelay);
		});
	}
}

describe('ConditioningModule', () => {
	let testingModule: TestingModule;
	let module: ConditioningModule;
	beforeEach(async () => {
		// Create a testing module with mocked dependencies
		testingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({ isGlobal: true }), // Import ConfigModule for ConfigService, required by ConditioningController
				ConditioningModule
			],
		})
		.overrideProvider(ConfigService) // Mock the ConfigService
		.useValue({
			get: jest.fn((key: string) => {
				switch (key) {
				case 'modules.conditioning.repos.fs.dataDir':
					return 'test-data-dir';
				default:
					return null;
				}
			}),
		})
		.overrideProvider(MergedStreamLogger) // Mock the MergedStreamLogger
		.useValue({
			registerMapper: jest.fn(),
			subscribeToStreams: jest.fn(),
			unsubscribeComponent: jest.fn(),
			unsubscribeAll: jest.fn(),
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
		.overrideProvider(PersistenceAdapter)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			create: jest.fn(),
			fetchAll: jest.fn(),
			fetchById: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			undelete: jest.fn(),
		})
		.overrideProvider(ConditioningDataService)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			isReady: async () => Promise.resolve(true),
			registerSubcomponent: jest.fn(),
			unregisterSubcomponent: jest.fn(),
			componentState$: new Subject<ComponentStateInfo>(),	
		})
		.overrideProvider(ConditioningLogCreatedHandler)
		.useValue({})
		.overrideProvider(ConditioningLogDeletedHandler)
		.useValue({})
		.overrideProvider(ConditioningLogUpdatedHandler)
		.useValue({})
		.overrideProvider(ConditioningLogRepository)
		.useValue({
			initialize: async () => Promise.resolve(void 0),
			shutdown: async () => Promise.resolve(void 0),
			isReady: async () => Promise.resolve(true),
			registerSubcomponent: jest.fn(),
			unregisterSubcomponent: jest.fn(),
			componentState$: new Subject<ComponentStateInfo>(),			
		})
		.overrideProvider(ConditioningController)
		.useValue({
			// Basic mock implementation of controller methods
			createUser: jest.fn(),
			deleteUser: jest.fn(),
			undeleteUser: jest.fn(),
		})
		.compile();
	  
		module = testingModule.get<ConditioningModule>(ConditioningModule);
	  });

	afterEach(async () => {
		await testingModule.close();
	});

	it('can be created', () => {
		expect(module).toBeDefined();
		expect(module).toBeInstanceOf(ConditioningModule);
	});
});