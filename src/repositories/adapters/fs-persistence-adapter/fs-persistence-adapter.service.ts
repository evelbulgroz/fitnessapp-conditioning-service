import { Injectable } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";
import * as fs from "node:fs/promises";

import { EntityMetadataDTO, FileSystemPersistenceAdapter, Result } from '@evelbulgroz/ddd-base';

import { ConditioningLogDTO } from '../../../dtos/domain/conditioning-log.dto';
import { ConditioningLogPersistenceDTO } from '../../../dtos/domain/conditioning-log-persistence.dto';

/** Injectable wrapper for file system persistence adapter for use with repositories.
 * @typeparam T The type of entity data transfer object (DTO) that the adapter will be working with.
 * @remark Concrete implementation of the PersistenceAdapter class, providing CRUD methods that interact with a file system.
 * @see PersistenceAdapter for more details on the supported CRUD methods and their expected behavior.
 */
@Injectable()
export class FsPersistenceAdapterService<T extends ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>> extends FileSystemPersistenceAdapter<T> {
	constructor(
		private config: ConfigService,
	) {
		void config //suppress unused variable warning
		super(config.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir');
	}

	/**
	* @todo: Retire this when implemented in ddd-base library
	*/
	public async initialize(): Promise<Result<void>> {
		try {
			// Check if the storage path exists (throws if it doesn't)
			await fs.access(this.storagePath);
		
			// Test read and write permissions (throws if either is missing)
			await fs.access(this.storagePath, fs.constants.R_OK | fs.constants.W_OK);
		}
		catch (err) {
			if (err.code === 'ENOENT') {
				// Storage path does not exist, create it
				try {
					await fs.mkdir(this.storagePath, { recursive: true });
				}
				catch (mkdirErr) { // Error creating directory
					return Promise.resolve(Result.fail<void>(mkdirErr.message));
				}
			}
			else { // Permission error
				return Promise.resolve(Result.fail<void>(err.message));
			}
		}
	
		return Promise.resolve(Result.ok<void>());
	}
}

export default FsPersistenceAdapterService;