import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

import { createTestingModule } from '../../test/test-utils';
import { User } from '../../domain/user.entity';
import { UserContext } from '../../domain/user-context.model';
import { UserDTO } from '../../dtos/domain/user.dto';
import { UserRepository } from '../../repositories/user.repo';
import { UserService } from './user.service';


describe('UserService', () => {
	let config: ConfigService;
	let module: TestingModule;
	let service: UserService;
	let userRepoUpdatesSubject: Subject<any>;
	beforeEach(async () => {
		userRepoUpdatesSubject = new Subject<any>();				

		module = await createTestingModule({
			imports: [
				// ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				ConfigService,
				{
					provide: Logger,
					useClass: ConsoleLogger
				},
				{
					provide: 'REPOSITORY_THROTTLETIME', // ms between execution of internal processing queue
					useValue: 100						// figure out how to get this from config
				},
				{
					provide: UserRepository,
					useValue: {
						isReady: jest.fn(),
						create: jest.fn(),
						fetchAll: jest.fn(),
						fetchById: jest.fn(),
						update: jest.fn(),
						delete: jest.fn(),
						updates$: userRepoUpdatesSubject.asObservable(),
					}
				},
				UserService
			],
		});

		config = module.get<ConfigService>(ConfigService);
		service = module.get<UserService>(UserService);
	});

	let randomDTO: UserDTO;
	let randomIndex: number;
	let randomUser: User;
	let userContext: UserContext;
	let userDTOs: UserDTO[];
	beforeEach(() => {
		userDTOs = [
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
			{ userId: uuidv4(), logs: [uuidv4(), uuidv4(), uuidv4()], className: 'User' },
		];

		randomIndex = Math.floor(Math.random() * userDTOs.length);
		randomDTO = userDTOs[randomIndex];
		randomUser = User.create(randomDTO).value as unknown as User;

		userContext = new UserContext({
			userId: randomUser.userId,
			userName: config.get<any>('security.collaborators.user.serviceName'), // display name for user, or service name if user is a service account (subName from JWTPayload)
			userType: 'service', // 'service' or 'user'
			roles: ['admin'], // roles assigned to the user
		});
	});

	it('can be created', () => {
		expect(service).toBeDefined();
	});
});
