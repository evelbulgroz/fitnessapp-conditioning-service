import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import BcryptCryptoService from './crypto/bcrypt-crypto.service';
import CryptoService from './crypto/models/crypto-service.model';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from './jwt/jwt-secret.service';
import JwtService from './jwt/models/jwt-service.model';
import JsonWebtokenService from './jwt/json-webtoken.service';

@Module({
	imports: [],
	providers: [
		{
		provide: CryptoService,
		useClass: BcryptCryptoService,
		},
		JwtAuthStrategy,
		{
		provide: JwtService,
		useFactory: (secretService: JwtSecretService) => {
			return new JsonWebtokenService(secretService);
		},
		inject: [JwtSecretService],
		},
		{
		provide: JwtSecretService,
		useFactory: (configService: ConfigService) => {
			const secret = configService.get<string>('security.authentication.jwt.accessToken.secret') ?? 'secret-not-found';
			return new JwtSecretService(secret);
		},
		inject: [ConfigService],
		},
		// later: add registration and token services
	],
	exports: [
		CryptoService,
		JwtAuthStrategy,
		JwtService,
		JwtSecretService,
	],
})
export class AuthenticationModule {}
export default AuthenticationModule;