/** Specifies the public interface for a service that manages the data needed for making authenticated requests to other microservices.
 * @remarks This could be a JWT token, an OAuth token, an API key, etc., depending on the implementation.
 * @remarks Also provides methods for logging in and out of the authentication microservice at server startup and shutdown
 * @remarks Concrete classes should manage the entire lifecycle of retrieval and refreshing of the authentication data.
 * @remarks Abstract class so it can be used as a dependency injection token in NestJS (interfaces cannot be used as tokens as they have no runtime representation). 
*/
export abstract class AuthService {
	/**
	 * Retrieves the current valid authentication data needed for making authenticated requests to other microservices.
	 * This could be a JWT token, an OAuth token, an API key, etc., depending on the implementation.
	 * @returns A promise that resolves to the authentication data needed for making authenticated requests.
	 */
	public abstract getAuthData(): Promise<string>;

	/** Trigger the login process to get the auth data
	 * @returns Promise containing the auth data
	 * @remarks Facade for getAuthData(), in the public API mainly as a matter of convention
	 */
	public abstract login(): Promise<{accessToken: string, refreshToken: string}>;

	/** Trigger the logout process to clear the auth data
	 * @returns Promise containing the logout response, or an error message
	 * @remarks Will clear auth data and pass it to the auth service for invalidation
	 */
	public abstract logout(): Promise<string>;	
}

export default AuthService;