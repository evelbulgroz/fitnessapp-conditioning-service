import { EntityDeletedEventDTO } from "@evelbulgroz/ddd-base";
import { UserDTO } from "../dtos/domain/user.dto";

export interface UserDeletedEventDTO extends EntityDeletedEventDTO<UserDTO> {
	// Add custom properties here
}

export default UserDeletedEventDTO;
