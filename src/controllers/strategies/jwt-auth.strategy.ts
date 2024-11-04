import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

import { Logger } from '@evelbulgroz/ddd-base';

import { AuthStrategy } from "./auth-strategy.model";
import { CryptoService } from "../../services/crypto/models/crypto-service.model";
import { JwtAuthResult } from "src/services/jwt/models/jwt-auth-result.model";
import { JwtPayload } from "../../services/jwt/models/jwt-payload.model";
import { JwtPayloadType } from "../../services/jwt/models/jwt-payload.type";
import { JwtService } from "../../services/jwt/models/jwt-service.model";
import { VerifyOptions as JwtVerifyOptions } from "../../services/jwt/models/jwt-verify-options.model";
import { User } from "../../domain/user.entity";
import { UserDTO } from "../..//dtos/user.dto";
import { UserRepository } from "../../repositories/user-repo.model";


/** Authentication strategy for JWT tokens for use with AuthGuard class.
 * @remark Concrete implementation of {@link AuthStrategy} using {@link JsonWebtokenService}.
 * @remark This class is intended to be used with the {@link AuthGuard} class to protect controller routes.
 * @todo Add logging
 */
@Injectable()
export class JwtAuthStrategy extends AuthStrategy {
	private readonly MAX_TOKEN_SIZE: number;
	private readonly tokenIssuer: string;
	
	constructor(
		private readonly config: ConfigService,
		private readonly crypto: CryptoService,
		private readonly jwtService: JwtService,
		private readonly logger: Logger,
		private readonly userRepo: UserRepository<User, UserDTO>
	) {
		super();
		this.MAX_TOKEN_SIZE = this.config.get<number>('security.jwt.maxTokenSize')!; // Retrieve the max token size from config
		this.tokenIssuer = this.config.get<string>('security.authentication.jwt.issuer')!; // Retrieve the token issuer from config
	}

	/** Verify the JWT token and check that it has the correct claims.
	 * @param token The token to verify
	 * @param options The Jwt VerifyOptions to use when verifying the token (or undefined for defaults)
	 * @returns The decoded payload
	 * @throws Error if the token is invalid or missing required claims
	 * @remark This method is called by the AuthGuard class to verify the JWT token in the request header.
	 */
	public async verify<T = JwtPayloadType>(token: string, options?: JwtVerifyOptions): Promise<T> {
		if (token.length > this.MAX_TOKEN_SIZE) {
			this.logger.error('Token too large');
			throw new Error('Token too large');
		}
		
		const decoded = await this.jwtService.verify(token, options) as JwtPayload;  // throws error if invalid, e.g. missing 'exp' or 'iat' claims
		
		const requiredClaims = ['iss', 'aud', 'exp', 'iat', 'jti', 'sub', 'subName', 'subType'];
		for (const claim of requiredClaims) {
			if (!(decoded as any)[claim]) {
				this.logger.error(`Missing token claim: ${claim}`);
				throw new Error(`Missing token claim: ${claim}`);
			}
		}
		
		return decoded as T;
	}

	/** Validate the values of Jwt payload claims and return the client (user or service) object.
	 * @param payload The payload to validate (decoded token from verify method)
	 * @returns The validated client (user or service) object
	 * @throws UnauthorizedException if the token is invalid
	 * @remark This method is called by the AuthGuard class to validate the token payload after verification.
	 * @remark Requesting users are validated by checking that the id in the 'sub' claim exists in the user repository.
	 * @remark Requesting services are validated by checking that the 'subName' claim matches a known collaborator service in config.
	 * @remark More complex user or service validation should be done by data service when called by controller.
	 */
	public async validate(payload: JwtPayload): Promise<JwtAuthResult> {
		if (payload.subType !== 'service' && payload.subType !== 'user') {
			this.logger.error(`Invalid token subject type: ${payload.subType}`);
			throw new Error('Invalid token subject type');
		}

		if (payload.subType === 'service') {
			await this.validateServiceToken(payload); // throws error if invalid
		}
		
		if (payload.subType === 'user') {
			await this.validateUserToken(payload); // throws error if invalid
		}

		// 'exp' implicitly validated by jwtService.verify method
		
		return { // validation succesful -> return client object
			userId: payload.sub,
			userName: payload.subName,
			userType: payload.subType === 'user' ? 'user' : 'service',
			roles: payload.roles ?? []
		} as JwtAuthResult;
	}

	private async validateServiceToken(payload: JwtPayload): Promise<void> {
		// 'iss' claim should be auth service
		if (payload.iss !== this.tokenIssuer) {
			this.logger.error(`Invalid token issuer: ${payload.iss}`);
			throw new Error('Invalid token issuer');
		}
		// 'aud' claim should be or include this service's name
		const ownServiceName = this.config.get('app.servicename');
		const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
		if (!aud.includes(ownServiceName)) {
			this.logger.error(`Invalid token audience: ${payload.aud}`);
			throw new Error('Invalid token audience');
		}

		// 'subName' should be a known collaborator service listed in the security config
		const collaborator = this.config.get(`security.collaborators.${payload.subName}`);
		if (!collaborator) {
			this.logger.error(`Invalid token subject name: ${payload.subName}`);
			throw new Error('Invalid token subject name');
		}
	}

	// validate encrypted iss and aud for user token
	private async validateUserToken(payload: JwtPayload): Promise<void> {
		// 'iss' claim should be auth service (encrypted)
		const isIssValid = await this.crypto.compare(this.tokenIssuer, payload.iss);
		if (!isIssValid) {
			this.logger.error(`Invalid token issuer: ${payload.iss}`);
			throw new Error('Invalid token issuer');
		}
		
		// 'aud' claim should be or include this service's name (encrypted)
		const ownServiceName = this.config.get('app.servicename');
		const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
		const isAudValid = await Promise.all(aud.map(async (a) => await this.crypto.compare(ownServiceName, a)));
		if (!isAudValid.includes(true)) {
			this.logger.error(`Invalid token audience: ${payload.aud}`);
			throw new Error('Invalid token audience');
		}

		// 'sub' claim should be a known user (by user id in user microservice)
		const userResult = await this.userRepo.fetchById(payload.sub);
		if(userResult.isFailure) {
			this.logger.error(`Invalid token subject: ${payload.sub}`);
			throw new Error('Invalid token subject');
		}		
	}
}


export default JwtAuthStrategy;