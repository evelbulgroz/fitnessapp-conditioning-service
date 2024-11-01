
/** Algorithms supported by the JSON Web Token specification.
 * @remarks Mimics the Algorithm type from the '@nestjs/jwt' package but avoids the dependency.
 */
export type Algorithm =
	| "HS256"
	| "HS384"
	| "HS512"
	| "RS256"
	| "RS384"
	| "RS512"
	| "ES256"
	| "ES384"
	| "ES512"
	| "PS256"
	| "PS384"
	| "PS512"
	| "none";

export default Algorithm;