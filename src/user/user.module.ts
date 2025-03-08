import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';

import UserController from './controllers/user.controller';
import UserRepository from './repositories/user.repo';

import UserService from './services/user.service';
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
  controllers: [UserController],
  providers: [
    UserService,
    UserRepository,
    {
      provide: 'UserFsPersistenceAdapter',
      useFactory: (configService: ConfigService) => {
        const dataDir = configService.get<string>('modules.user.repos.fs.dataDir') ?? 'no-such-dir';
        return new FsPersistenceAdapterService(dataDir);
      },
      inject: [ConfigService],
    },
  ],
  exports: [UserService, UserRepository],
})
export class UserModule {}
export default UserModule;