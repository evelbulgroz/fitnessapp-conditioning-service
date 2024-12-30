import { EntityMetadataDTO } from "@evelbulgroz/ddd-base";
import { TrainingLogPersistenceDTO } from "@evelbulgroz/fitnessapp-base";

import { ConditioningLogDTO } from "./conditioning-log.dto";

/** Specifies a generic subtype of TrainingLogPersistenceDTO that holds business data from ConditioningLogDTO subtype ConditioningLogDTO */
export type ConditioningLogPersistenceDTO<T extends ConditioningLogDTO, U extends EntityMetadataDTO> =  TrainingLogPersistenceDTO<T, U>;

/** Shorthand (for internal use only) */
export type PersistenceDTO = ConditioningLogPersistenceDTO<ConditioningLogDTO, EntityMetadataDTO>;

export default ConditioningLogPersistenceDTO;