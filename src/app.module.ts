import { Module } from '@nestjs/common';

import { AggregationQueryMapper } from './mappers/aggregation-query.mapper';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueryMapper } from './mappers/query.mapper';
import { FsPersistenceAdapterService } from './repositories/adapters/fs-persistence-adapter/fs-persistence-adapter.service';
import { PersistenceAdapter } from '@evelbulgroz/ddd-base';

@Module({
	imports: [],
	controllers: [AppController],
	providers: [
		AggregationQueryMapper,
		AppService,
		QueryMapper,
		{
			provide: PersistenceAdapter,
			useClass: FsPersistenceAdapterService,
		}
	],
})
export class AppModule {}
