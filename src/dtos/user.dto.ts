import { EntityDTO, EntityId } from '@evelbulgroz/ddd-base';

export interface UserDTO extends EntityDTO {
	userId: EntityId;
	logs?: EntityId[];
}

export default UserDTO;