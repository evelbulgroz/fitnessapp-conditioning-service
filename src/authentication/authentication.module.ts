import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import BcryptCryptoService from './services/crypto/bcrypt-crypto.service';
import CryptoService from './services/crypto/domain/crypto-service.model';
import JwtAuthStrategy from '../infrastructure/strategies/jwt-auth.strategy';
import JwtSecretService from './services/jwt/jwt-secret.service';
import JwtService from './services/jwt/domain/jwt-service.model';
import JsonWebtokenService from './services/jwt/json-webtoken.service';

@Module({
	imports: [],
	providers: [
		{ // CryptoService
			provide: CryptoService,
			useClass: BcryptCryptoService,
		},
		JwtAuthStrategy,
		{ // JwtService
			provide: JwtService,
			useFactory: (secretService: JwtSecretService) => {
				return new JsonWebtokenService(secretService);
			},
			inject: [JwtSecretService],
		},
		{ // JwtSecretService
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