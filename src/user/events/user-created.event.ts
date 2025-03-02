import { EntityCreatedEvent } from '@evelbulgroz/ddd-base';
import { UserDTO } from '../user/dtos/user.dto';

import { UserCreatedEventDTO } from './user-created.event.dto';

/** User created domain event
 * @remarks Dispatched when a user is created in the repository
*/
export class UserCreatedEvent extends EntityCreatedEvent<UserCreatedEventDTO, UserDTO> {
	constructor(dto: UserCreatedEventDTO) {
		super(dto);
	}
}

export default UserCreatedEvent;