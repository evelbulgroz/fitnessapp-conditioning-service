import { EntityMetadataDTO, EntityPersistenceDTO } from "@evelbulgroz/ddd-base";

import { UserDTO}  from "../../dtos/domain/user.dto";

export type UserPersistenceDTO = EntityPersistenceDTO<UserDTO, EntityMetadataDTO>;

export default UserPersistenceDTO;