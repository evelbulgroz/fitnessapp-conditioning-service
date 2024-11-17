import { Module } from '@nestjs/common';

import { AggregationQueryMapper } from './mappers/aggregation-query.mapper';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueryMapper } from './mappers/query.mapper';

@Module({
	imports: [],
	controllers: [AppController],
	providers: [
		AggregationQueryMapper,
		AppService,
		QueryMapper
	],
})
export class AppModule {}
