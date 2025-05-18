import { EntityDTO, EntityMetadataDTO, EntityPersistenceDTO, FileSystemPersistenceAdapter } from '@evelbulgroz/ddd-base';

import { ManagedStatefulComponent, ManagedStatefulComponentMixin } from '../../../libraries/managed-stateful-component';
/**
 *  FileSystemAdapter implementing the ManagedStatefulComponentMixin.
 *  
 * Wrapper for the FileSystemPersistenceAdapter that adds state management capabilities.
 * 
 */
export class ManagedStatefulFsPersistenceAdapter<T extends EntityPersistenceDTO<EntityDTO, EntityMetadataDTO>>
	extends ManagedStatefulComponentMixin(FileSystemPersistenceAdapter)<T>
	implements ManagedStatefulComponent
{
	constructor(storagePath: string) {
		super(storagePath);
	}
}
export default ManagedStatefulFsPersistenceAdapter;