import { EntityDeletedEvent } from '@evelbulgroz/ddd-base';

import { UserDTO } from '../dtos/domain/user.dto';
import { UserDeletedEventDTO } from './user-deleted.event.dto';

/** User deleted domain event
 * @remarks Dispatched when a user is deleted from the repository
*/
export class UserDeletedEvent extends EntityDeletedEvent<UserDeletedEventDTO, Partial<UserDTO>> {
	constructor(dto: UserDeletedEventDTO) {
		super(dto);
	}
}

export default UserDeletedEvent;