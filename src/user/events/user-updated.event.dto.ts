import { EntityUpdatedEventDTO } from "@evelbulgroz/ddd-base";
import { UserDTO } from "../user/dtos/user.dto";

export interface UserUpdatedEventDTO extends EntityUpdatedEventDTO<Partial<UserDTO>> {
	// Add custom properties here
}

export default UserUpdatedEventDTO;
