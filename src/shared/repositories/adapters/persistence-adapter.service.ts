import { Injectable } from '@nestjs/common';

import { EntityMetadataDTO, PersistenceAdapter} from '@evelbulgroz/ddd-base';

import { ConditioningLogDTO } from '../../../conditioning/dtos/conditioning-log.dto';
import { ConditioningLogPersistenceDTO } from '../../../conditioning/dtos/conditioning-log-persistence.dto';

/** Injectable wrapper for persistence adapter for use with repositories.
 * @typeparam T The type of entity data transfer object (DTO) that the adapter will be working with.
 * @remark Concrete implementation of the PersistenceAdapter class, providing CRUD methods that interact with a file system.
 * @see PersistenceAdapter for more details on the supported CRUD methods and their expected behavior.
 */
@Injectable()
export abstract class PersistenceAdapterService<T extends ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>> extends PersistenceAdapter<T> {
	// no need to implement the constructor here, defer to concrete classes
}

export default PersistenceAdapterService;