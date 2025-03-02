import { UserDTO } from '../user/dtos/user.dto';
import { UserDeletedEventDTO } from './user-deleted.event.dto';
import { EntityUndeletedEvent } from '@evelbulgroz/ddd-base/dist/events/entity-undeleted.event.class';

/** User deleted domain event
 * @remarks Dispatched when a user is deleted from the repository
*/
export class UserUndeletedEvent extends EntityUndeletedEvent<UserDeletedEventDTO, Partial<UserDTO>> {
	constructor(dto: UserDeletedEventDTO) {
		super(dto);
	}
}

export default UserUndeletedEvent;