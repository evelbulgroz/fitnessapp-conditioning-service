import { EntityUpdatedEvent } from '@evelbulgroz/ddd-base';
import { UserDTO } from '../../dtos/user.dto';

import { UserUpdatedEventDTO } from './user-updated.dto';

/** Generic base class for Entity update event
 * @template T Type of the event DTO
 * @template U Type of the event payload (a partial EntityDTO)
 */
export class UserUpdatedEvent extends EntityUpdatedEvent<UserUpdatedEventDTO, Partial<UserDTO>> {
	constructor(dto: UserUpdatedEventDTO) {
		super(dto);
	}
}

export default UserUpdatedEvent;