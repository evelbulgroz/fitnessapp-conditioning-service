import { JwtPayload } from "./jwt-payload.model";
import { JwtPayloadType } from "./jwt-payload.type";
import { DecodeOptions } from "./jwt-decode-options.model";
import { JwtSecretService } from "../jwt-secret.service";
import { SignOptions } from "./jwt-sign-options.model";
import { VerifyOptions } from "./jwt-verify-options.model";

/** Abstract base class defining the public API for services that provide JWT token signing, verification and decoding.
 * @remark Intended for use as injection token in DI systems; not intended for direct use.
 */
export abstract class JwtService {
	/** Create a new instance of the JwtService.
	 * @param secretService The service that provides the secret used to sign and verify JWT tokens
	 */
	constructor(protected readonly secretService: JwtSecretService) {}
	
	/** Decode a JWT token.
	 * @param token The token to decode
	 * @param options The options to use when decoding the token (optional)
	 * @returns The decoded token
	 * @throws Error if the token cannot be decoded
	 */
	public abstract decode<T = JwtPayloadType>(token: string, options?: DecodeOptions): Promise<T>;
	
	/** Sign a JWT token with the given payload and options.
	 * @param payload The payload to sign (only JwtPayload is supported)
	 * @param options The options to use when signing the token (optional)
	 * @returns The signed token
	 * @throws Error if the token cannot be signed
	 * @remark secretOrPrivateKey handled internally
	 */
	public abstract sign(payload: JwtPayload, options?: SignOptions): Promise<string>;

	/** Verify a JWT token.
	 * @param token The token to verify
	 * @param options The options to use when verifying the token (optional)
	 * @returns The verified token
	 * @throws Error if the token cannot be verified
	 * @remark secretOrPublicKey handled internally
	 */
	public abstract verify<T = JwtPayloadType>(token: string, options?: VerifyOptions): Promise<T>;
}

export default JwtService;