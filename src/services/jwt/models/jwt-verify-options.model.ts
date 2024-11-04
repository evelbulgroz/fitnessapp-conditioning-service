import Algorithm from "./jwt-algorithm.model";

/** Specifies the options for verifying a JSON Web Token.
 * @remark Mimics the VerifyOptions interface from the 'jsonwebtoken' package but avoids the dependency.
 */
export interface VerifyOptions {
	/** List of accepted algorithms. */
	algorithms?: Algorithm[] | undefined;

	/** Audience(s) that the JWT is intended for. */
	audience?: string | RegExp | Array<string | RegExp> | undefined;

	/** The timestamp to use as the current time for verification purposes. */
	clockTimestamp?: number | undefined;

	/** The amount of clock skew to tolerate when verifying the `nbf` and `exp` claims, in seconds. */
	clockTolerance?: number | undefined;

	/** Return an object with the decoded `{ payload, header, signature }` instead of only the usual content of the payload. */
	complete?: boolean | undefined;

	/** The issuer(s) that the JWT is expected to have. */
	issuer?: string | string[] | undefined;

	/** If `true`, do not validate the `exp` claim. */
	ignoreExpiration?: boolean | undefined;

	/** If `true`, do not validate the `nbf` claim. */
	ignoreNotBefore?: boolean | undefined;

	/** The JWT ID (jti) claim to check against. */
	jwtid?: string | undefined;

	/** If you want to check `nonce` claim, provide a string value here.
	 * It is used on Open ID for the ID Tokens. ([Open ID implementation notes](https://openid.net/specs/openid-connect-core-1_0.html#NonceNotes))
	 */
	nonce?: string | undefined;

	/** The subject (sub) claim to check against. */
	subject?: string | undefined;

	/** The maximum allowed age for tokens to be considered valid, in seconds or a string describing a time span. */
	maxAge?: string | number | undefined;

	/** If `true`, allow invalid asymmetric key types. */
	allowInvalidAsymmetricKeyTypes?: boolean | undefined;
}

export default VerifyOptions;