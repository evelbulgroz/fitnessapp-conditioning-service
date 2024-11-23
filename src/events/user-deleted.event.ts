import { EntityDeletedEvent } from '@evelbulgroz/ddd-base';
import { UserDTO } from '../dtos/domain/user.dto';
import { UserDeletedEventDTO } from './user-deleted.event.dto';

/** User deleted domain event */
export class UserDeletedEvent extends EntityDeletedEvent<UserDeletedEventDTO, UserDTO> {
	constructor(dto: UserDeletedEventDTO) {
		super(dto);
	}
}

export default UserDeletedEvent;