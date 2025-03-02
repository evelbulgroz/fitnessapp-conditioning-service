import { EntityUndeletedEventDTO } from '@evelbulgroz/ddd-base/dist/dtos/entity-undeleted.event.dto'; // workaround until included in ddd-base package

import { UserDTO } from "../user/dtos/user.dto";

export interface UserUndeletedEventDTO extends EntityUndeletedEventDTO<Partial<UserDTO>> {
	// Add custom properties here
}

export default UserUndeletedEventDTO;
