import { Module } from '@nestjs/common';

import { AggregationQueryMapper } from './conditioning/mappers/aggregation-query.mapper';
import { ConditioningController } from './conditioning/controllers/conditioning.controller';
import { QueryMapper } from './conditioning/mappers/query.mapper';
import { FsPersistenceAdapterService } from './shared/repositories/adapters/fs-persistence-adapter/fs-persistence-adapter.service';
import { PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { UserService } from './user/services/user.service';
import { UserController } from './user/controllers/user.controller';
import { JwtService } from './shared/services/authentication/jwt/models/jwt-service.model';
import { JsonWebtokenService } from './shared/services/authentication/jwt/json-webtoken.service';

// todo: Copy over (de)registration logic from API Gateway to be able to effectively authenticate and collaborate with other microservices
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
			provide: JwtService,
			useClass: JsonWebtokenService,
		},
		{
			provide: PersistenceAdapter,
			useClass: FsPersistenceAdapterService,
		},
		UserService
	],
})
export class AppModule {}
