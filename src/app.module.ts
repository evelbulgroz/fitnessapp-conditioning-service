import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Module, Logger as NestLogger }  from '@nestjs/common';
import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

import { ConsoleLogger, Logger }  from '@evelbulgroz/ddd-base';

import AuthenticationModule from './authentication/authentication.module';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import UserController  from './user/controllers/user.controller';
import UserModule from './user/user.module';

import productionConfig from './../config/production.config';
import developmentConfig from '../config/development.config';
import { RetryHttpService } from './shared/services/utils/retry-http/retry-http.service';

//class NestJSLogger extends NestLogger {} // Enable injection of NestJS Logger despite name conflit with ddd-base Logger


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
		{ // Logger compatible with ddd-base library
			provide: Logger,
			useClass: ConsoleLogger,
		},
		/*{ // Logger compatible with NestJS
			provide: NestJSLogger,
			useClass: NestLogger,
		},*/
		{ // Provide RetryHttpService in place of HttpModule
		  provide: HttpService,
		  useClass: RetryHttpService,
		},
	],
	exports: [
		AuthenticationModule,
		ConditioningModule,
		ConfigModule,
		EventDispatcherService,
		Logger,		
		UserModule,
	]
})
export class AppModule {}