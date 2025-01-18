import { Module } from '@nestjs/common';

import { AggregationQueryMapper } from './mappers/aggregation-query.mapper';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConditioningController } from './controllers/conditioning.controller';
import { QueryMapper } from './mappers/query.mapper';
import { FsPersistenceAdapterService } from './repositories/adapters/fs-persistence-adapter/fs-persistence-adapter.service';
import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { UserService } from './services/user/user.service';

@Module({
	imports: [],
	controllers: [
		AppController,
		ConditioningController
	],
	providers: [
		AggregationQueryMapper,
		AppService,
		QueryMapper,
		{
			provide: PersistenceAdapter,
			useClass: FsPersistenceAdapterService,
		},
		UserService
	],
})
export class AppModule {}
