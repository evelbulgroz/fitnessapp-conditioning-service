import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

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

import productionConfig from '../../config/production.config';
import developmentConfig from '../../config/development.config';

@Module({
	imports: [
		ConfigModule.forRoot({
		load: [() => {				
			// conditionally load config based on environment
			// note: test config is loaded by test-utils.ts,
			//	as the app module is not used in unit tests
			return process.env.NODE_ENV === 'production' ? productionConfig() : developmentConfig();
		}],
		isGlobal: true,
		}),
	],
	controllers: [
		ConditioningController
	],
	providers: [
		AggregatorService,
		AggregationQueryMapper,
		ConditioningDataService,
		ConditioningLogCreatedHandler,
		ConditioningLogUpdateHandler,
		ConditioningLogDeletedHandler,
		ConditioningLogUndeletedHandler,
		ConditioningLogRepository,
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
		ConditioningLogRepository
	],
})
export class ConditioningModule {}
export default ConditioningModule;