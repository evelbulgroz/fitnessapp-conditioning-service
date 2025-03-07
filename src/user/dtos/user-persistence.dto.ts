import { EntityMetadataDTO, EntityPersistenceDTO } from "@evelbulgroz/ddd-base";

import { UserDTO}  from "./user.dto";

export type UserPersistenceDTO = EntityPersistenceDTO<UserDTO, EntityMetadataDTO>;

export default UserPersistenceDTO;