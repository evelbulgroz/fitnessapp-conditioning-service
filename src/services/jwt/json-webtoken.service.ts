import jwt from 'jsonwebtoken';

import { JwtPayload } from "./models/jwt-payload.model";
import { DecodeOptions as JwtDecodeOptions } from "./models/jwt-decode-options.model";
import { JwtPayloadType } from "./models/jwt-payload.type";
import { JwtSecretService } from "./jwt-secret.service";
import { JwtService } from "./models/jwt-service.model";
import { SignOptions as JwtSignOptions } from "./models/jwt-sign-options.model";
import { VerifyOptions as JwtVerifyOptions } from "./models/jwt-verify-options.model";

/** Signs, verifies, and decodes JWT tokens using the 'jsonwebtoken' library.
 * @remark Concrete implementation of the JWT service API using the 'jsonwebtoken' library.
 * @remark Intended for extraction into a separate package so avoids NestJS dependencies.
 */
export class JsonWebtokenService extends JwtService {	
	constructor(secretService: JwtSecretService) {		
		super(secretService);
	}

	//------------------------------- PUBLIC API -----------------------------

	public async sign(payload: JwtPayload, options?: JwtSignOptions): Promise<string> {
		return new Promise((resolve, reject) => {
			jwt.sign(payload, this.secretService.getSecret(), options ?? {}, (err, token) => {
				if (err) {
					return reject(err);
				}
				resolve(token!);
			});
		});
	}

	public async verify<T = JwtPayloadType>(token: string, options?: JwtVerifyOptions): Promise<T> {
		const payload = jwt.decode(token) as JwtPayload;
		return new Promise((resolve, reject) => {
			jwt.verify(token, this.secretService.getSecret(), options ?? {}, (err, decoded) => {
				if (err) {
					return reject(err);
				}
				resolve(decoded as T);
			});
		});
	}

	public async decode<T = JwtPayloadType>(token: string, options?: JwtDecodeOptions): Promise<T> {
		const decoded = jwt.decode(token, options)!;
		if (!decoded) {
			throw new Error('Invalid token');
		}
		return decoded as T;
	}
}

export default JsonWebtokenService;