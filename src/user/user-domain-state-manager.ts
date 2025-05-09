import { Injectable } from "@nestjs/common";

import DomainStateManager from "../libraries/managed-stateful-component/helpers/domain-state-manager.class";
import UserDataService from "./services/user-data.service";
import UserRepository from "./repositories/user.repo";

// Domain proxy that stands in for user module to enable hierarchical state management
@Injectable()
export class UserDomainStateManager extends DomainStateManager {
	constructor(
		// Inject services from this domain that should be monitored
		private userService: UserDataService,
		private userRepository: UserRepository,
	) {
		super();
		
	}
	
	async onInitialize() {
		// Register domain services as subcomponents
		this.registerSubcomponent(this.userService);
		this.registerSubcomponent(this.userRepository);
		
		// Domain-specific initialization
	}
}
export default UserDomainStateManager;