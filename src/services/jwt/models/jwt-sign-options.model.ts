import { Algorithm as Algorithm } from "./jwt-algorithm.model";
import { JwtHeader as JwtHeader } from "./jwt-header.model";

/* Specifies the options for signing a JSON Web Token.
 * @remarks Mimics the SignOptions interface from the 'jsonwebtoken' package but avoids the dependency.
 */
export interface SignOptions {
	/** Signature algorithm. Could be one of these values :
	 * - HS256:		HMAC using SHA-256 hash algorithm (default)
	 * - HS384:		HMAC using SHA-384 hash algorithm
	 * - HS512:		HMAC using SHA-512 hash algorithm
	 * - RS256:		RSASSA using SHA-256 hash algorithm
	 * - RS384:		RSASSA using SHA-384 hash algorithm
	 * - RS512:		RSASSA using SHA-512 hash algorithm
	 * - ES256:		ECDSA using P-256 curve and SHA-256 hash algorithm
	 * - ES384:		ECDSA using P-384 curve and SHA-384 hash algorithm
	 * - ES512:		ECDSA using P-521 curve and SHA-512 hash algorithm
	 * - none:		 No digital signature or MAC value included
	 */
	algorithm?: Algorithm | undefined;
	
	/** A hint indicating which key was used to secure the JWT. This parameter allows for key rotation. */
	keyid?: string | undefined;
	
	/** Specifies the expiration time of the token.
	 * @remarks It can be expressed in seconds or as a string describing a time span (e.g., "2 days", "10h", "7d"). This is used to set the exp (expiration time) claim.
	 * @remarks [zeit/ms](https://github.com/zeit/ms.js) is used to parse the string.
	 */
	expiresIn?: string | number;
	
	/** Specifies the time before which the token must not be accepted for processing.
	 * @remarks It can be expressed in seconds or as a string describing a time span. This is used to set the nbf (not before) claim.
	 * @remarks [zeit/ms](https://github.com/zeit/ms.js) is used to parse the string.
	 */
	notBefore?: string | number | undefined;
	
	/** Identifies the recipients that the JWT is intended for. This is used to set the aud (audience) claim.
	 * @remarks This can be a string or an array of strings.
	 */
	audience?: string | string[] | undefined;
	
	/** Identifies the principal that issued the JWT. This is used to set the sub (subject) claim. */
	subject?: string | undefined;
	
	/** Identifies the principal that issued the JWT. This is used to set the iss (issuer) claim. */
	issuer?: string | undefined;
	
	/** Unique identifier for the JWT. This is used to set the jti (JWT ID) claim. */
	jwtid?: string | undefined;
	
	/** If set to true, the payload will be mutated directly instead of being cloned. */
	mutatePayload?: boolean | undefined;
	
	/** If set to true, the iat (issued at) claim will not be included in the token. */
	noTimestamp?: boolean | undefined;
	
	/** Allows you to specify additional headers for the JWT. This can include custom headers or override the default headers. */
	header?: JwtHeader | undefined;
	
	/** Specifies the encoding to be used for the token. The default is typically utf8. */
	encoding?: string | undefined;
	
	/** If set to true, allows the use of insecure key sizes. This is generally not recommended for production use. */
	allowInsecureKeySizes?: boolean | undefined;
	
	/** if set to true, allows the use of invalid asymmetric key types. This is generally not recommended for production use. */
	allowInvalidAsymmetricKeyTypes?: boolean | undefined;
}

export default SignOptions;