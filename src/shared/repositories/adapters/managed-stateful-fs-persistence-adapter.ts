import { EntityDTO, EntityMetadataDTO, EntityPersistenceDTO, FileSystemPersistenceAdapter, Result } from '@evelbulgroz/ddd-base';

import { ManagedStatefulComponent, ManagedStatefulComponentMixin } from '../../../libraries/managed-stateful-component';
/**
 *  FileSystemAdapter implementing the ManagedStatefulComponentMixin.
 *  
 * Wrapper for the FileSystemPersistenceAdapter that adds state management capabilities.
 * 
 * Currently, mainly exists to enable registration of the adapter as a repository subcomponent,
 * so its state can be included in the overall state of the application, e.g. in health checks.
 * 
 * A unique instance of this class should be created for each repository, to keep data segregated.
 * 
 * @example
 * 
 * ```typescript
 * // ... module boilerplate
 *   providers: [
 *     //.. other providers
 *     ConfigService, // NestJS config service, assumes config includes a dataDir property
 *     { // Persistence adapter for file system storage
 *       provide: PersistenceAdapter,
 *         useFactory: (configService: ConfigService) => {
 *           const dataDir = configService.get<string>('modules.conditioning.repos.fs.dataDir') ?? 'no-such-dir';
 *           return new ManagedStatefulFsPersistenceAdapter(dataDir);
 *       },
 *       inject: [ConfigService],
 *      },
 *    ],
 * // rest of module boilerplate
 * ```
 * 
 */
export class ManagedStatefulFsPersistenceAdapter<T extends EntityPersistenceDTO<EntityDTO, EntityMetadataDTO>>
	extends ManagedStatefulComponentMixin(FileSystemPersistenceAdapter)<T>
	implements ManagedStatefulComponent
{
	public constructor(storagePath: string) {
		super(storagePath);
	}

	// For now, no need for custom methods or overrides.
}
export default ManagedStatefulFsPersistenceAdapter;