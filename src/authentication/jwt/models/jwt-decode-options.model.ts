/** Specifies the options for decoding a JSON Web Token.
 * @remark Mimics the DecodeOptions interface from the 'jsonwebtoken' package but avoids the dependency.
 */
export interface DecodeOptions {
	/** If `true`, the token will be decoded without verifying its signature. */
	complete?: boolean | undefined;

	/** If `true`, the token will be decoded as a JSON object. */
	json?: boolean | undefined;
}

export default DecodeOptions;