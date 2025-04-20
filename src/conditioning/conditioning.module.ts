import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileSystemPersistenceAdapter, PersistenceAdapter } from '@evelbulgroz/ddd-base';

import AggregationQueryMapper from './mappers/aggregation-query.mapper';
import AggregatorService from './services/aggregator/aggregator.service';
import ConditioningController from './controllers/conditioning.controller';
import ConditioningLogCreatedHandler from './handlers/conditioning-log-created.handler';
import ConditioningDataService from './services/conditioning-data/conditioning-data.service';
import ConditioningLogDeletedHandler from './handlers/conditioning-log-deleted.handler';
import ConditioningLogRepository from './repositories/conditioning-log.repo';
import ConditioningLogUndeletedHandler from './handlers/conditioning-log-undeleted.handler';
import ConditioningLogUpdateHandler from './handlers/conditioning-log-updated.handler';
import QueryMapper from './mappers/query.mapper';

@Module({
	imports: [],
	controllers: [
		ConditioningController
	],
	providers: [
		AggregatorService,
		AggregationQueryMapper,
		ConditioningDataService,
		ConditioningLogCreatedHandler,
		ConditioningLogDeletedHandler,
		ConditioningLogRepository,
		ConditioningLogUndeletedHandler,
		ConditioningLogUpdateHandler,
		{
			provide: PersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
				return new FileSystemPersistenceAdapter(dataDir);
			},
			inject: [ConfigService],
		},
		QueryMapper,
		{
			provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
			useValue: 100
		},		
	],
	exports: [
		ConditioningDataService,
		ConditioningLogCreatedHandler,
		ConditioningLogDeletedHandler,
		ConditioningLogRepository,
		ConditioningLogUndeletedHandler,
		ConditioningLogUpdateHandler,
	],
})
export class ConditioningModule {}
export default ConditioningModule;

/* Example implementation supporting the ManagedStatefulComponent interface
@Module({
  providers: [ConditioningDataService, ConditioningLogRepository]
})
export class ConditioningModule extends ManagedStatefulComponentMixin(class {}) implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly dataService: ConditioningDataService,
    private readonly logRepo: ConditioningLogRepository,
    @Inject(LOGGER_TOKEN) public readonly logger: Logger
  ) {
    super();
  }

  public async executeInitialization(): Promise<void> {
    await this.dataService.initialize();
    await this.logRepo.initialize();
  }

  public async executeShutdown(): Promise<void> {
    await this.dataService.shutdown();
    await this.logRepo.shutdown();
  }

  // Map NestJS lifecycle hooks to our component lifecycle
  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    await this.shutdown();
  }

  // Enhanced health check that aggregates component statuses
  public async getAggregateHealth(): Promise<ModuleHealthStatus> {
    const dataServiceState = this.dataService.getState();
    const logRepoState = this.logRepo.getState();

    return {
      moduleName: this.constructor.name,
      moduleState: this.getState(),
      components: [dataServiceState, logRepoState],
      isHealthy: this.getState().state === ComponentState.OK &&
                 [dataServiceState, logRepoState].every(s => 
                   s.state === ComponentState.OK || s.state === ComponentState.DEGRADED)
    };
  }
}
  */