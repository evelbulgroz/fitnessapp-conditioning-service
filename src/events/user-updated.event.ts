import { EntityUpdatedEvent } from '@evelbulgroz/ddd-base';
import { UserDTO } from '../dtos/domain/user.dto';

import { UserUpdatedEventDTO } from './user-updated.event.dto';

/** User updated domain event */
export class UserUpdatedEvent extends EntityUpdatedEvent<UserUpdatedEventDTO, Partial<UserDTO>> {
	constructor(dto: UserUpdatedEventDTO) {
		super(dto);
	}
}

export default UserUpdatedEvent;