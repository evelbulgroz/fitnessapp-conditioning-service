/** Specifies the standard claims in the payload of a JSON Web Token issued or consumed in this application.
 * @remarks Mimics the JwtPayload interface from the '@nestjs/jwt' package but avoids the dependency, enhances the documentation, and modifies the optionality of the standard claims.
 * @todo Import this interface from the authentication microservice when available.
*/
export interface JwtPayload {
	/** Issuer: The issuer of the token, typically the authentication microservice (by name, as instance ID may change) */
	iss: string;

	/** Subject: The user or microservice to whom the JWT was issued (by ID) */
	sub: string;

	/** Audience: The microservices that will process requests from the sub (by name, as instance IDs may change) */
	aud: string | string[] ;

	/** Expiration time: Unix timestamp */
	exp: number;

	/** Not before time: Unix timestamp */
	nbf?: number | undefined;

	/** Issued at time: Unix timestamp */
	iat: number;

	/** JWT ID: unique identifier for the token */
	jti: string;

	/** Custom claim: name of the microservice or user to whom the token is issued (if applicable) */
	subName: string;

	/** Custom claim: indicates whether the token is for a user or a microservice */
	subType: 'user' | 'service';

	/** Custom claim: roles assigned to the user or microservice */
	roles?: string[];
}

export default JwtPayload;