import { Algorithm as Algorithm } from "./jwt-algorithm.model";

/** Specifies the header of a JSON Web Token as defined by the JWT specification.
 * @remarks Mimics the JwtHeader interface from the '@nestjs/jwt' package but avoids the dependency.
 */
export interface JwtHeader {
	/** The type of token, typically "JWT". */
	typ?: string | undefined;

	/** The signing algorithm being used, such as "HS256" or "RS256". */
	alg: string;

	/** The content type of the JWT. */
	cty?: string | undefined;

	/** The key ID used to select the key for signature validation. */
	kid?: string | undefined;

	/** The X.509 URL pointing to the certificate chain used to sign the token. */
	x5u?: string | undefined;

	/** The X.509 certificate chain used to sign the token. */
	x5c?: string[] | undefined;

	/** The X.509 certificate SHA-1 thumbprint. */
	x5t?: string | undefined;

	/** The X.509 certificate SHA-256 thumbprint. */
	'x5t#S256'?: string | undefined;

	/** The critical header fields that must be understood and processed. */
	crit?: string[] | undefined;
}

export default JwtHeader;