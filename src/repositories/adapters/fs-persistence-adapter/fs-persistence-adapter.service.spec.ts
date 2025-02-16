import { Test, TestingModule } from '@nestjs/testing';

import { ConsoleLogger, EntityMetadataDTO, FileSystemPersistenceAdapter } from '@evelbulgroz/ddd-base';

import { FsPersistenceAdapterService } from './fs-persistence-adapter.service';
import { ConditioningLogPersistenceDTO } from '../../../dtos/domain/conditioning-log-persistence.dto';
import { ConditioningLogDTO } from '../../../dtos/domain/conditioning-log.dto';
import { createTestingModule } from '../../../test/test-utils';

//process.env.NODE_ENV = 'untest'; // ConsoleLogger will not log in test environment

// NOTE: Base class is already fully tested in library, so just check that the service is created correctly

describe('FsPersistenceAdapterService', () => {
	let service: FsPersistenceAdapterService<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>;

	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			// ConfigModule is imported automatically by createTestingModule
			providers: [
				FsPersistenceAdapterService,
			],
		}))
		.compile();

		service = module.get<FsPersistenceAdapterService<ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>>>(FsPersistenceAdapterService);
	});

	it('can be created', () => {
		expect(service).toBeDefined();
	});

	it('is an instance of FsPersistenceAdapterService', () => {
		expect(service).toBeInstanceOf(FsPersistenceAdapterService);
	});

	it('inherits from FileSystemPersistenceAdapter', () => {
		expect(service).toBeInstanceOf(FileSystemPersistenceAdapter);
	});

	it('has a storage path', () => {
		expect(service['storagePath']).toBeDefined();
	});
});
