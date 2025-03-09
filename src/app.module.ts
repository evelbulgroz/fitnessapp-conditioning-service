import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Global, Module }  from '@nestjs/common';

import { ConsoleLogger, Logger }  from '@evelbulgroz/ddd-base';

import AuthenticationModule from './authentication/authentication.module';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import JwtAuthStrategy from './infrastructure/strategies/jwt-auth.strategy';
import UserController  from './user/controllers/user.controller';
import UserModule from './user/user.module';

import productionConfig from './../config/production.config';
import developmentConfig from '../config/development.config';


// todo: Copy over (de)registration logic from API Gateway to be able to effectively authenticate and collaborate with other microservices
@Global()
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
		ConditioningModule,
		UserModule,
		AuthenticationModule,
	],
	controllers: [
		ConditioningController,
		UserController
	],
	providers: [		
		ConfigService,
		EventDispatcherService,
		{
			provide: Logger,
			useClass: ConsoleLogger,
		}
	],
	exports: [
		EventDispatcherService,
		JwtAuthStrategy,
		Logger
	]
})
export class AppModule {}
