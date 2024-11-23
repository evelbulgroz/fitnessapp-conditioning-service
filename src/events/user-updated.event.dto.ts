import { EntityUpdatedEventDTO } from "@evelbulgroz/ddd-base";
import { UserDTO } from "../dtos/domain/user.dto";

export interface UserUpdatedEventDTO extends EntityUpdatedEventDTO<UserDTO> {
	// Add custom properties here
}

export default UserUpdatedEventDTO;
