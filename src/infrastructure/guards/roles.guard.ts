import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		// Check if the endpoint is marked as public
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) {
			return true; // Allow unrestricted access to public endpoints
		}
	
		// Retrieve roles metadata
		const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
		if (!requiredRoles || requiredRoles.length === 0) {
			return true; // Allow access if no roles are defined
		}
	
		// Retrieve user roles from the request
		const request = context.switchToHttp().getRequest();
		const userRoles = request.user?.roles || [];
	
		// Check if the user has at least one of the required roles
		return requiredRoles.some((role) => userRoles.includes(role));
	}
}