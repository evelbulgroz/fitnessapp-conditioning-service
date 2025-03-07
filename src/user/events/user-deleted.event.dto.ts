import { EntityDeletedEventDTO } from "@evelbulgroz/ddd-base";
import { UserDTO } from "../dtos/user.dto";

export interface UserDeletedEventDTO extends EntityDeletedEventDTO<Partial<UserDTO>> {
	// Add custom properties here
}

export default UserDeletedEventDTO;
