import { Injectable } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";

import { EntityMetadataDTO, FileSystemPersistenceAdapter } from '@evelbulgroz/ddd-base';

import { ConditioningLogDTO } from '../../../dtos/domain/conditioning-log.dto';
import { ConditioningLogPersistenceDTO } from '../../../dtos/domain/conditioning-log-persistence.dto';

/** Injectable wrapper for file system persistence adapter for use with repositories.
 * @typeparam T The type of entity data transfer object (DTO) that the adapter will be working with.
 * @remark Concrete implementation of the PersistenceAdapter class, providing CRUD methods that interact with a file system.
 * @see PersistenceAdapter for more details on the supported CRUD methods and their expected behavior.
 */
@Injectable()
export class FsPersistenceAdapterService<T extends ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>> extends FileSystemPersistenceAdapter<T> {
	  constructor(private config: ConfigService) {
		void config //suppress unused variable warning
		super(config.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir');
	  }  
}

export default FsPersistenceAdapterService;