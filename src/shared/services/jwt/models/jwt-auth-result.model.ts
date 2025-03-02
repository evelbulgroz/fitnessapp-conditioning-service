/** The result of validating a JWT token.
 * @remark This interface is used by the {@link JwtAuthStrategy} class to return the client ID and name from the JWT payload.
 * @remark Both properties are required, but clients may vary in which properties they use.
 */
export interface JwtAuthResult {
	/** The ID of the requesting user or microservice from the JWT sub claim. */
	userId: string;

	/** The name of the requesting user or microservice from the JWT subName custom claim. */
	userName: string;

	/** The type of client that requested the token. */
	userType: 'user' | 'service';

	/** The roles assigned to the client, if any. */
	roles?: string[];
}

export default JwtAuthResult;