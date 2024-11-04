import { Injectable } from '@nestjs/common';

/**Service for managing the secret used to sign and verify JWT tokens
 * @remark Intended for use by a JWT service to enable dynamic secret management
 * without exposing the API for changing the secret on the JWT service itself.
 */
@Injectable()
export class JwtSecretService {
	constructor(private _secret: string = '') {}

	getSecret(): string {
		return this._secret;
	}

	setSecret(newSecret: string) {
		this._secret = newSecret;
	}	
}

export default JwtSecretService;