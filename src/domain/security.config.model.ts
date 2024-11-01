/* Security config */
export interface SecurityConfig {
	environment: string;

	/** Authentication configuration for each supported system user */
	authentication?: { 
		/** Authentication configuration for this service */
		app: AuthenticationConfig;
		
		/** JWT auth configuration */
		jwt: JwtAuthConfig;
	};

	/** Configuration for each service that can access this service
	 * @remarks If e.g. a JWT token's custom 'subName' claim does not match a service in this list, the token will be rejected
	 */
	collaborators: {
		/** Configuration for each service that can access this service */
		[key: string]: CollaboratorConfig;
	};		
	
	/** Verification configuration for registering with registry at startup */
	verification?: VerificationConfig;
}

/** Authentication configuration */
export interface AuthenticationConfig {	
	/** Password for initial log in (hashed for security)
	 * @remarks Password is only used for initial log in to the service
	 * @remarks Subsequent authentication is done using JWT tokens signed/verified with separate token secrets:
	 * @remarks - unlike passwords, token secrets are not shared with other services
	 * @remarks Auth service does not require a password to log in to itself: set to any string
	*/
	password: string;
}

/** Configuration for a service that can access this service */
export interface CollaboratorConfig {
	/** Name of the service, e.g. passed in the custom 'subName' claim  of a JWT token */
	serviceName: string;
}

/** JWT auth configuration */
export interface JwtAuthConfig {	
	/** Name of the service issuing the token
	 * @remarks Should be matched by the e.g. 'iss' claim in the JWT token, or the token will be rejected
	 */
	issuer: string;

	/** Configuration for JWT access tokens */
	accessToken: JwtTokenConfig

	/** Configuration for JWT refresh tokens */
	refreshToken: JwtTokenConfig;

	/** Maximum size of the JWT token in bytes */
	maxTokenSize: number;	
}

export interface JwtTokenConfig {
	/** Secret used to sign and later verify this service's JWT authentication token */
	secret: string;
	/** Algorithm used to sign and later verify this service's JWT authentication token */
	algorithm: string;
	/** Expiry time for this service's JWT authentication token */
	expiration: string;
}

/** Verification configuration for registering with registry at startup */
export interface VerificationConfig {
	bootstrap: {
		/** Secret shared with registry used to obtain verification token at bootstrap, hashed for security */
		secret: string;
	};
}

export default SecurityConfig;