import { Injectable } from "@nestjs/common";

/** Abstract class for authentication strategies for use in route guards.
 * @remark Mimics the similarly named class from the @nestjs/passport package but avoids the dependency.
 */
@Injectable()
export abstract class AuthStrategy {

	/** Validate the payload. 
	 * @param payload The payload to validate
	 * @returns the validated user object
	*/
	public abstract validate(payload: any): Promise<any>;

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