import { Module } from '@nestjs/common';

import { AggregationQueryMapper } from './mappers/aggregation-query.mapper';
import { ConditioningController } from './controllers/conditioning.controller';
import { QueryMapper } from './mappers/query.mapper';
import { FsPersistenceAdapterService } from './repositories/adapters/fs-persistence-adapter/fs-persistence-adapter.service';
import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { UserService } from './services/user/user.service';
import { UserController } from './controllers/user.controller';

@Module({
	imports: [],
	controllers: [
		ConditioningController,
		UserController
	],
	providers: [
		AggregationQueryMapper,
		QueryMapper,
		{
			provide: PersistenceAdapter,
			useClass: FsPersistenceAdapterService,
		},
		UserService
	],
})
export class AppModule {}
