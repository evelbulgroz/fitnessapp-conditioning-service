import { Injectable } from "@nestjs/common";

/** Base class for authentication strategies for use in route guards.
 * @remark Mimics the similarly named class from the @nestjs/passport package but avoids the dependency.
 * @remark Concrete to enable subclass inheritance from StreamLoggableMixin, but should otherwise be treated as if abstract.
 */
@Injectable()
export class AuthStrategy {

	/** Validate the payload. 
	 * @param payload The payload to validate
	 * @returns the validated user object
	*/
	public validate(payload: any): Promise<any> {
		// This method should be implemented by subclasses to provide custom behavior.
		throw new Error('Method not implemented.');
	}

	/* Log in with the provided credentials.
	 * @param credentials The credentials to use for logging in
	 * @returns the authenticated user object
	 * @throws UnauthorizedException if the credentials are invalid
	 * @remark This method should be implemented by subclasses to provide custom behavior.
	 * @todo Consider including this later in order to more fully mimic the @nestjs/passport package.
	*/
	//public abstract login(credentials: any): Promise<any>;

	/* Log out the current user.
	 * @returns void
	 * @throws UnauthorizedException if the user is not logged in
	 * @remark This method should be implemented by subclasses to provide custom behavior.
	 * @todo Consider including this later in order to more fully mimic the @nestjs/passport package.
	*/
	//public abstract logout(): Promise<void>;
}

export default AuthStrategy;