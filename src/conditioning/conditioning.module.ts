import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ComponentStateInfo, ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { FileSystemPersistenceAdapter, PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { StreamLoggableMixin } from '../libraries/stream-loggable';

import AggregationQueryMapper from './mappers/aggregation-query.mapper';
import AggregatorService from './services/aggregator/aggregator.service';
import ConditioningController from './controllers/conditioning.controller';
import ConditioningLog from './domain/conditioning-log.entity';
import ConditioningLogDTO from './dtos/conditioning-log.dto';
import ConditioningLogCreatedHandler from './handlers/conditioning-log-created.handler';
import ConditioningDataService from './services/conditioning-data/conditioning-data.service';
import ConditioningLogDeletedHandler from './handlers/conditioning-log-deleted.handler';
import ConditioningLogRepository from './repositories/conditioning-log.repo';
import ConditioningLogUndeletedHandler from './handlers/conditioning-log-undeleted.handler';
import ConditioningLogUpdatedHandler from './handlers/conditioning-log-updated.handler';
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
		ConditioningLogUpdatedHandler,
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
		ConditioningLogUpdatedHandler,
	],
})
export class ConditioningModule extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements OnModuleInit, OnModuleDestroy {
	constructor(
		private readonly conditioningLogRepository: ConditioningLogRepository<ConditioningLog<any, ConditioningLogDTO>, ConditioningLogDTO>,
		private readonly conditioningDataService: ConditioningDataService,
	) {
		super();
		
	}

	public async onModuleInit(): Promise<void> {
		this.registerSubcomponent(this.conditioningLogRepository); // repo handles persistence initialization internally
		this.registerSubcomponent(this.conditioningDataService);
		await this.initialize(); // initialize module and all subcomponents
	}

	public async onModuleDestroy(): Promise<void> {
		await this.shutdown(); // shutdown module and all subcomponents
		this.unregisterSubcomponent(this.conditioningLogRepository); // repo handles persistence shutdown internally
		this.unregisterSubcomponent(this.conditioningDataService);
	}
	
}
export default ConditioningModule;