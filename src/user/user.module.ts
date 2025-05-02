import { ConfigService } from '@nestjs/config';
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { FileSystemPersistenceAdapter, PersistenceAdapter } from '@evelbulgroz/ddd-base';
import { ManagedStatefulComponentMixin } from '../libraries/managed-stateful-component';
import { StreamLoggableMixin } from '../libraries/stream-loggable';

import UserController from './controllers/user.controller';
import UserCreatedHandler from './handlers/user-created.handler';
import UserDeletedHandler from './handlers/user-deleted.handler';
import UserRepository from './repositories/user.repo';
import UserDataService from './services/user-data.service';
import UserUpdatedHandler from './handlers/user-updated.handler';
import UserPersistenceDTO from './dtos/user-persistence.dto';

@Module({
	imports: [],
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
		UserDataService,
		UserUpdatedHandler,
	],
	exports: [
		UserCreatedHandler,
		UserDeletedHandler,
		UserRepository,
		UserDataService,
		UserUpdatedHandler,
	],
})
export class UserModule extends StreamLoggableMixin(ManagedStatefulComponentMixin(class {})) implements OnModuleInit, OnModuleDestroy {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly userDataService: UserDataService,
	) {
		super();
	}

	public async onModuleInit(): Promise<void> {
		console.debug('UserModule: onModuleInit() called');
		this.registerSubcomponent(this.userRepository); // repo handles persistence initialization internally
		this.registerSubcomponent(this.userDataService);
		await this.initialize(); // // initialize module and all subcomponents
	}

	public async onModuleDestroy(): Promise<void> {
		console.debug('UserModule: onModuleDestroy() called');
		await this.shutdown(); // shutdown module and all subcomponents		
		this.unregisterSubcomponent(this.userRepository); // repo handles persistence shutdown internally
		this.unregisterSubcomponent(this.userDataService);
	}

}
export default UserModule;