import { Injectable } from '@nestjs/common';

import bcrypt from 'bcryptjs';

import { CryptoService } from './models/crypto-service.model';


/** Service that provides cryptographic hashing and comparison using the 'bcrypt' library.
 * @remark Concrete implementation of the CryptoService using the 'bcrypt' library.
 */
@Injectable()
export class BcryptCryptoService implements CryptoService {
	async hash(property: string): Promise<string> {
		const salt = await bcrypt.genSalt(10);
		return await bcrypt.hash(property, salt);
	}

	async compare(property: string, hash: string): Promise<boolean> {
		return await bcrypt.compare(property, hash);
	}
}
export default BcryptCryptoService;