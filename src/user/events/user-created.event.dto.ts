import { EntityCreatedEventDTO } from "@evelbulgroz/ddd-base";

import { UserDTO } from "../user/dtos/user.dto";

export interface UserCreatedEventDTO extends EntityCreatedEventDTO<UserDTO> {
	// Add custom properties here
}

export default UserCreatedEventDTO;
