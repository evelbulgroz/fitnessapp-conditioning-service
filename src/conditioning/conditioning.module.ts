import { forwardRef, Module } from '@nestjs/common';
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
import UserModule from 'src/user/user.module';

@Module({
	imports: [
		forwardRef(() => UserModule), // Use forwardRef to handle circular dependency
	],
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