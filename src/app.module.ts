import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Module }  from '@nestjs/common';

import { ConsoleLogger, Logger }  from '@evelbulgroz/ddd-base';

import AggregatorService  from './conditioning/services/aggregator/aggregator.service';
import AggregationQueryMapper  from './conditioning/mappers/aggregation-query.mapper';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningDataService  from './conditioning/services/conditioning-data/conditioning-data.service';
import ConditioningLogCreatedHandler from './conditioning/handlers/conditioning-log-created.handler';
import ConditioningLogDeletedHandler from './conditioning/handlers/conditioning-log-deleted.handler';
import ConditioningLogUndeletedHandler from './conditioning/handlers/conditioning-log-undeleted.handler';
import ConditioningLogUpdateHandler from './conditioning/handlers/conditioning-log-updated.handler';
import ConditioningLogRepository  from './conditioning/repositories/conditioning-log.repo';
import CryptoService from './shared/services/authentication/crypto/models/crypto-service.model';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import QueryMapper  from './conditioning/mappers/query.mapper';
import FsPersistenceAdapterService  from './shared/repositories/adapters/fs-persistence-adapter/fs-persistence-adapter.service';
import JwtAuthStrategy from './infrastructure/strategies/jwt-auth.strategy';
import JwtService  from './shared/services/authentication/jwt/models/jwt-service.model';
import JsonWebtokenService  from './shared/services/authentication/jwt/json-webtoken.service';
import PersistenceAdapterService from './shared/repositories/adapters/persistence-adapter.service';
import UserService  from './user/services/user.service';
import UserController  from './user/controllers/user.controller';
import UserCreatedHandler from './user/handlers/user-created.handler';
import UserUpdatedHandler from './user/handlers/user-updated.handler';
import UserDeletedHandler from './user/handlers/user-deleted.handler';
import UserRepository from './user/repositories/user.repo';

import productionConfig from './../config/production.config';
import developmentConfig from '../config/development.config';

// todo: Copy over (de)registration logic from API Gateway to be able to effectively authenticate and collaborate with other microservices
@Module({
	imports: [
		HttpModule,
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
	controllers: [
		ConditioningController,
		UserController
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
		ConfigService,
		CryptoService,
		EventDispatcherService,
		JwtAuthStrategy,
		QueryMapper,
		{
			provide: JwtService,
			useClass: JsonWebtokenService,
		},
		{
			provide: Logger,
			useClass: ConsoleLogger,
		},
		{
			provide: PersistenceAdapterService,
			useClass: FsPersistenceAdapterService,
		},
		{
			provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
			useValue: 100
		},
		UserCreatedHandler,
		UserUpdatedHandler,
		UserDeletedHandler,
		UserUpdatedHandler,
		UserRepository,
		UserService,
	],
})
export class AppModule {}
