import { ConfigService } from '@nestjs/config';
import { forwardRef, Module } from '@nestjs/common';

import { FileSystemPersistenceAdapter, PersistenceAdapter } from '@evelbulgroz/ddd-base';

import AuthenticationModule from '../authentication/authentication.module';
import ConditioningModule from '../conditioning/conditioning.module';
import UserController from './controllers/user.controller';
import UserCreatedHandler from './handlers/user-created.handler';
import UserDeletedHandler from './handlers/user-deleted.handler';
import UserRepository from './repositories/user.repo';
import UserService from './services/user.service';
import UserUpdatedHandler from './handlers/user-updated.handler';

@Module({
	imports: [
		forwardRef(() => AuthenticationModule), // Use forwardRef to handle circular dependency
		forwardRef(() => ConditioningModule), // Use forwardRef to handle circular dependency
	],
	controllers: [UserController],
	providers: [
		{
			provide: PersistenceAdapter,
			useFactory: (configService: ConfigService) => {
				const dataDir = configService.get<string>('modules.user.repos.fs.dataDir') ?? 'no-such-dir';
				return new FileSystemPersistenceAdapter(dataDir);
			},
			inject: [ConfigService],
		},
		{
			provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
			useValue: 100
		},
		UserCreatedHandler,
		UserDeletedHandler,
		UserRepository,
		UserService,
		UserUpdatedHandler,
	],
	exports: [
		UserCreatedHandler,
		UserDeletedHandler,
		UserRepository,
		UserService,
		UserUpdatedHandler,
	],
})
export class UserModule {}
export default UserModule;