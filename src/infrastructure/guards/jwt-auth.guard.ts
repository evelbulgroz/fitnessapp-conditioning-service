import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthStrategy } from '../strategies/jwt-auth.strategy';
import { JwtPayload } from '../../authentication/services/jwt/domain/jwt-payload.model';

/** Verifies the JWT token in the request header, when used in a route guard.
* @see AuthGuard
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard {
	constructor(private readonly strategy: JwtAuthStrategy, private readonly reflector: Reflector) {
		super();
	}

	/** Verify the JWT token in the request header.
	 * @param context ExecutionContext object
	 * @returns true if the token is valid, false otherwise
	 * @throws UnauthorizedException if the token is missing or invalid
	*/
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		
		if (isPublic) { // skip authentication for public routes
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const token = this.extractTokenFromHeader(request);

		if (!token) {
			throw new UnauthorizedException('No token provided');
		}

		try {
			const payload = await this.strategy.verify(token);
			const user = await this.strategy.validate(payload as JwtPayload);
			void this.handleRequest(null, user, null, context); // must call manually when not using the @nestjs/passport package
			return true;
		}
		catch (err) {
			void this.handleRequest(err, null, null, context);
			return false;
		}
	}

	/* Extract the JWT token from the request header. */
	private extractTokenFromHeader(request: Request): string | null {
		const authHeader = request.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			return authHeader.split(' ')[1];
		}
		return null;
	}
}

export default JwtAuthGuard;