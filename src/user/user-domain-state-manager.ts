import { Injectable, Optional, Inject } from "@nestjs/common";

import { ManagedStatefulComponentMixin } from "../libraries/managed-stateful-component";

import UserRepository from "./repositories/user.repo";
import UserDataService from "./services/user-data.service";
import e from "express";
import DomainStateManager from "src/libraries/managed-stateful-component/helpers/domain-state-manager.class";

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