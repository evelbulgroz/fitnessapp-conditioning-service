import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtAuthResult } from '../../services/jwt/models/jwt-auth-result.model';

/** Abstract class for route guards that require authentication.
 * @remark Mimics the similarly named class from the @nestjs/passport package but avoids the dependency.
 */
@Injectable()
export abstract class AuthGuard implements CanActivate {
	/** Verify the request is authorized.
	 * @param context ExecutionContext object
	 * @returns true if the request is authorized, false otherwise
	 * @throws UnauthorizedException if the request is not authorized
	 * @remark Implementing subclasses must call handleRequest() manually from the canActivate method.
	 */
	public abstract canActivate(context: ExecutionContext): Promise<boolean>;

	/** Handle the request after it has been processed by the route handler and the client object has been assigned to the request.
	 * @param err Error object
	 * @param user User object (created by the strategy)
	 * @param info Additional information
	 * @param context ExecutionContext object
	 * @returns true if the request is authorized, otherwise throws an UnauthorizedException
	 * @throws UnauthorizedException if the request is not authorized
	 * @remark This default method is called after the route handler has been processed. Subclasses can override this method to provide custom behavior.
	 * @remark More complex behavior could include logging, auditing, additional validation (e.g. of client object), redirecting and/or providing custom error messages.
	 */
	public async handleRequest(err: any, user: JwtAuthResult | null, info: any, context: ExecutionContext): Promise<JwtAuthResult> {
		if (err || !user) {
			throw err || new UnauthorizedException('Invalid credentials');
		}

		const request = context.switchToHttp().getRequest();
    	request.user = user; // Set the user on the request object

		return user; // Return the user object
	}
}