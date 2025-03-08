import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import ConditioningController from './controllers/conditioning.controller';
import ConditioningLogRepository from './repositories/conditioning-log.repo';
import ConditioningDataService from './services/conditioning-data/conditioning-data.service';
import FsPersistenceAdapterService from '../shared/repositories/adapters/fs-persistence-adapter/fs-persistence-adapter.service';

import productionConfig from '../../config/production.config';
import developmentConfig from '../../config/development.config';

@Module({
  imports: [
	ConfigModule.forRoot({
		load: [() => {				
			// conditionally load config based on environment
			// note: test config is loaded by test-utils.ts,
			//  as the app module is not used in unit tests
			return process.env.NODE_ENV === 'production' ? productionConfig() : developmentConfig();
		}],
		isGlobal: true,
	}),
],
  controllers: [ConditioningController],
  providers: [
    ConditioningDataService,
    ConditioningLogRepository,
    {
      provide: 'ConditioningLogFsPersistenceAdapter',
      useFactory: (configService: ConfigService) => {
        const dataDir = configService.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
        return new FsPersistenceAdapterService(dataDir);
      },
      inject: [ConfigService],
    },
  ],
  exports: [ConditioningDataService, ConditioningLogRepository],
})
export class ConditioningModule {}
export default ConditioningModule;