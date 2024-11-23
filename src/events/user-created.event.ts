import { EntityCreatedEvent } from '@evelbulgroz/ddd-base';
import { UserDTO } from '../dtos/domain/user.dto';

import { UserCreatedEventDTO } from './user-created.event.dto';

/** User created domain event */
export class UserCreatedEvent extends EntityCreatedEvent<UserCreatedEventDTO, UserDTO> {
	constructor(dto: UserCreatedEventDTO) {
		super(dto);
	}
}

export default UserCreatedEvent;