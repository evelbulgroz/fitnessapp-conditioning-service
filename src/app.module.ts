import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Global, Module }  from '@nestjs/common';

import { ConsoleLogger, Logger }  from '@evelbulgroz/ddd-base';

import BcryptCryptoService from './shared/services/authentication/crypto/bcrypt-crypto.service';
import ConditioningController  from './conditioning/controllers/conditioning.controller';
import ConditioningModule from './conditioning/conditioning.module';
import CryptoService from './shared/services/authentication/crypto/models/crypto-service.model';
import EventDispatcherService  from './shared/services/utils/event-dispatcher/event-dispatcher.service';
import JwtAuthStrategy from './infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from './shared/services/authentication/jwt/jwt-secret.service';
import JwtService  from './shared/services/authentication/jwt/models/jwt-service.model';
import JsonWebtokenService  from './shared/services/authentication/jwt/json-webtoken.service';
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
	],
	controllers: [
		ConditioningController,
		UserController
	],
	providers: [		
		ConfigService,
		{
			provide: CryptoService,
			useClass: BcryptCryptoService,
		},
		EventDispatcherService,
		JwtAuthStrategy,		
		{
			provide: JwtService,
			useFactory: (secretService: JwtSecretService) => {
				return new JsonWebtokenService(secretService);
			},
			inject: [JwtSecretService],
		},
		{
			provide: JwtSecretService,
			useFactory: (configService: ConfigService) => {
				const secret = configService.get<string>('security.authentication.jwt.accessToken.secret') ?? 'secret-not-found';
				return new JwtSecretService(secret);
			},
			inject:	[ConfigService],
		},
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
