import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable, RequestMethod } from '@nestjs/common';

import { firstValueFrom, Observable } from 'rxjs';
import jwt from 'jsonwebtoken';

import { Logger } from '@evelbulgroz/ddd-base';

import { AppConfig, EndPointConfig, ServiceConfig } from '../../../shared/domain/config-options.model';
import AuthService from '../../domain/auth-service.class';
import BootstrapResponseDTO from '../../dtos/responses/bootstrap-response.dto';
import JwtDTO from '../../dtos/responses/jwt.dto';
import LocateDataDTO from '../../dtos/requests/locate-data.dto';
import ServiceDataDTO from '../../dtos/responses/service-data.dto';
import ServiceLoginDataDTO from '../../dtos/requests/service-login-data.dto';
import ServiceLogoutDataDTO from '../../dtos/requests/service-logout-data.dto';
import ServiceTokenRefreshDataDTO from '../../dtos/requests/service-token-refresh-data.dto';

/** Manages and provides access to the current JWT token needed for making authenticated requests to other microservices.
 * @remark Also provides methods for logging in and out of the authentication microservice at server startup and shutdown
 * @remark Will recursively retry http requests if they fail, up to the maximum number of attempts specified in config for the endpoint or microservice
 */
@Injectable()
export class TokenService extends AuthService {
	private _accessToken: string | undefined;
	private _refreshToken: string | undefined;
	private _loginPromise: Promise<{ accessToken: string, refreshToken: string }> | undefined;
	private _refreshPromise: Promise<string> | undefined;

	//------------------------------------- CONSTRUCTOR -----------------------------------------//
	
	public constructor(
		private readonly config: ConfigService,
		private readonly httpService: HttpService,
		private readonly logger: Logger,
	) {
		super();
		void this.httpService; // suppress compiler warning about unused variable (hidden by 'self' in executeRequest)
		// intentionally empty: trying to set the token here breaks server startup
	}

	//------------------------------------- PUBLIC API ------------------------------------------//

	/** Get the current auth token, requesting a new one if needed
	 * @returns Promise containing the access token
	 * @remark Orchestrates the whole login and token refresh process, including bootstrap and authentication
	 * @remark Guards against concurrent calls triggering overlapping login or refresh requests
	 * @remark Will refresh the access token if it is invalid, using the refresh token if available and valid
	 * @remark Will log in (anew) if no access token is available, or if the refresh token is invalid
	 */
	public async getAuthData(): Promise<string> {		
		const self = this; // store a reference to the current instance for use in nested functions
		
		// wrapper to guard against multiple login attempts running concurrently
		async function getLoginPromise(): Promise<{ accessToken: string, refreshToken: string }> {
			if (!self._loginPromise) {
				self._loginPromise = self.bootstrap()
					.then((bootstrapData) => self.authenticate(bootstrapData))
					.then((tokens) => {
						self._accessToken = tokens.accessToken;
						self._refreshToken = tokens.refreshToken;
						return tokens;
					})
					.finally(() => {
						self._loginPromise = undefined;
					});
			}
			return self._loginPromise;
		}

		// wrapper to guard against multiple refresh attempts running concurrently
		async function getRefreshPromise(): Promise<string> {
			if (!self._refreshPromise) { // use refreshPromise as guard against multiple refresh attempts running concurrently
				self._refreshPromise = self.refresh()
					.then((token) => {
						self._accessToken = token;
						return token;
					})
					.finally(() => {
						self._refreshPromise = undefined;
					});
			}
			return self._refreshPromise!;
		}

		if (!this._accessToken) { // access token not set -> log in
			void await getLoginPromise();
		}
		else { // access token set -> check if it is still valid
			const appConfig = this.config.get('app') ?? {} as AppConfig;
			const jwtConfig = this.config.get(`security.authentication.jwt`) ?? {};
			try {
				jwt.verify(this._accessToken, jwtConfig.accessToken.secret); // throws an error if the token is invalid
			}
			catch (error) { // access token invalid -> check if refresh token is set
				if (!this._refreshToken) { // refresh token not set -> log in
					void await getLoginPromise();
				}
				else { // refresh token set -> check if it is still valid
					try {
						jwt.verify(this._refreshToken!, jwtConfig.refreshTokenSecret);					
					}
					catch (error) {
						void await getLoginPromise(); // refresh token invalid -> log in anew
					}
					void await getRefreshPromise(); // refresh token valid -> refresh access token
				}
			}
		}

		// return the token
		return this._accessToken!;
	}

	/** Login to authentication microservice to get access and refresh tokens
	 * @returns Promise containing the access and refresh tokens
	 * @remark Facade for getAuthData(), in the public API mainly as a matter of convention
	 * @remark Clients should use getAuthData() instead of login() to get the access token
	 */
	public async login(): Promise<{accessToken: string, refreshToken: string}> {
		this.logger.log(`${this.constructor.name}.login Logging in to the auth service...`);
		void await this.getAuthData();
		return { accessToken: this._accessToken!, refreshToken: this._refreshToken! };
	}

	/** Logout from authentication microservice process to clear the access and refresh tokens
	 * @returns Promise containing the logout response, or an error message
	 * @remark Will clear the tokens and pass them to the auth service for invalidation
	 */
	public async logout(): Promise<string> {
		this.logger.log(`${this.constructor.name}.logout Logging out from the auth service...`);
				
		// get auth service endpoint from registry microservice
		const appConfig = this.config.get('app') ?? {} as AppConfig;
		const registryConfig = this.config.get('services.fitnessapp-registry-service') ?? {} as ServiceConfig;		
		const locateConfig = registryConfig?.endpoints?.locate ?? {} as EndPointConfig;
		let locateUrl = registryConfig?.baseURL.href + locateConfig.path;
		let locateBody = <LocateDataDTO>{
			requestingServiceId: appConfig.serviceid,
			requestingServiceName: appConfig.servicename,
			targetServiceName: 'fitnessapp-authentication-service'
		}
		let locateOptions = {
			headers: {
				authorization: `Bearer ${await this.getAuthData()}`
			}
		};
		const locateMethod = RequestMethod[locateConfig?.method?.toUpperCase()] as unknown as RequestMethod;	
		const locateResponse$ = this.executeRequest(locateUrl, locateMethod, locateBody, locateOptions);
		const authServiceData = new ServiceDataDTO((await firstValueFrom(locateResponse$)).data); // validate the response
		
		// set up logout request		
		const authServiceConfig = this.config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;
		const logoutConfig = authServiceConfig?.endpoints?.serviceLogout ?? {} as EndPointConfig;		
		const logoutUrl = authServiceData.location + logoutConfig.path;
		const logoutBody = <ServiceLogoutDataDTO>{
			serviceId: appConfig.serviceid,
			serviceName: appConfig.servicename,
			refreshToken: this._refreshToken
		};		
		const logoutOptions = {
			headers: {
				authorization: `Bearer ${await this.getAuthData()}`
			}
		}

		// execute logout request
		const logOutMethod = RequestMethod[logoutConfig?.method?.toUpperCase()] as unknown as RequestMethod;
		const logoutResponse$ = this.executeRequest(logoutUrl, logOutMethod, logoutBody, logoutOptions);
		const logoutResponse = await firstValueFrom(logoutResponse$);

		// validate the response
		if (!logoutResponse || logoutResponse.status !== 200) {
			const errorMsg = `${this.constructor.name}.logout Logout request failed`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}
		
		// clear the tokens
		this._accessToken = undefined;
		this._refreshToken = undefined;

		// log the response
		this.logger.log(`${this.constructor.name}.logout Logout from auth service successful`);

		// return the response
		return `${this.constructor.name}.logout Service logged out successfully`;
	}

	//----------------------------------- PROTECTED METHODS -------------------------------------//

	/* Log in to the auth service to get an access token
	 * @param bootstrapData - the response data from the bootstrap
	 * @returns Observable containing the login response, or an error message
	 * @throws Error if the login request fails, or if the response is invalid
	 * @remark Will throw an error if the response does not contain an access token or refresh token
	 * @remark Will throw an error if the response contains tokens that are invalid or incomplete
	 * @remark Will throw an error if the response contains auth service data that is invalid or incomplete
	 */
	protected async authenticate(bootstrapData: BootstrapResponseDTO): Promise<{accessToken: string, refreshToken: string}> {
		this.logger.log(`${this.constructor.name}.authenticate Logging in to the auth service...`);
		
		// set up data for request
		const appConfig = this.config.get('app') ?? {} as AppConfig;
		const authServiceConfig = this.config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;
		const loginConfig = authServiceConfig?.endpoints?.serviceLogin ?? {} as EndPointConfig;		
		const securityConfig = this.config.get('security') ?? {};
		const password = securityConfig.authentication?.app?.password;
		const url = bootstrapData.authServiceData?.location + loginConfig.path;		
		const body = <ServiceLoginDataDTO>{
			password,
			serviceId: appConfig.serviceid,
			serviceName: appConfig.servicename,
			verificationToken: bootstrapData.verificationToken
		};		
		const options = {
			headers: {
				authorization: `Bearer ${password}`
			}
		}
		
		// execute the request
		const method = RequestMethod[loginConfig?.method?.toUpperCase()] as unknown as RequestMethod;
		const response$ = this.executeRequest(url, method, body, options);
		const response = await firstValueFrom(response$);
		
		// validate the response
		if (!response || response.status !== 200) {
			const errorMsg = `${this.constructor.name}.authenticate Login request failed`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		// sanitize the tokens
		let accessToken: string, refreshToken: string;
		try {
			const [accessTokenDTO, refreshTokenDTO] = [new JwtDTO(response.data?.accessToken), new JwtDTO(response.data?.refreshToken)];
			accessToken = accessTokenDTO.value as string;
			refreshToken = refreshTokenDTO.value as string;
		}
		catch (error) {
			const errorMsg = `${this.constructor.name}.authenticate Login response invalid: ${error.message}`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		// validate the tokens
		const jwtConfig = this.config.get(`security.authentication.jwt`) ?? {};
		jwt.verify(accessToken, jwtConfig.accessToken.secret); // throws an error if the token is invalid
		jwt.verify(refreshToken, jwtConfig.refreshToken.secret);

		// log the response
		this.logger.log('Auth service login successful, tokens received and verified');//, `${this.constructor.name}.authenticate`);

		// return the tokens
		return { accessToken, refreshToken };
	}

	/* Bootstrap registration by getting a verification token from the microservice registry
	 * @returns Promise containing the bootstrap response, or an error message
	 * @throws Error if the bootstrap token request fails, or if the response is invalid
	 * @remark Will throw an error if the response does not contain a verification token
	 * @remark Will throw an error if the response contains auth service data that is invalid or incomplete
	 */
	protected async bootstrap(): Promise<BootstrapResponseDTO> {
		this.logger.log(`${this.constructor.name}.bootstrap Acquiring bootstrap token from microservice registry...`);
		
		// set up data for request
		const appConfig = this.config.get('app') ?? {} as AppConfig;
		const registryConfig = this.config.get('services.fitnessapp-registry-service') ?? {} as ServiceConfig;		
		const bootstrapConfig = registryConfig?.endpoints?.bootstrap ?? {} as EndPointConfig;		
		const sharedSecret = this.config.get('security.verification.bootstrap.secret') ?? '';		
		const url = registryConfig?.baseURL.href + bootstrapConfig.path + '/' + appConfig.servicename;
		const body = null;
		const options = {
			headers: {
				authorization: `Bearer ${sharedSecret}`
			}
		};

		// execute the request
		const method = RequestMethod[bootstrapConfig?.method?.toUpperCase()] as unknown as RequestMethod;
		const response$ =  this.executeRequest(url, method, body, options);
		const response = await firstValueFrom(response$);
		
		// validate the response
		if (!response || response.status !== 200) {
			const errorMsg = `${this.constructor.name}.bootstrap Bootstrap token request failed`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		// sanitize the response
		let bootstrapData: BootstrapResponseDTO;
		try {
			bootstrapData = new BootstrapResponseDTO(response.data);
		}
		catch (error) {
			const errorMsg = `${this.constructor.name}.bootstrap Bootstrap token response invalid: ${error.message}`
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		// log the response
		this.logger.log(`${this.constructor.name}.bootstrap Bootstrap token acquired from microservice registry`);

		// return the response data
		return bootstrapData;
	}

	/* Execute a request mapping RequestMethod to HttpService methods 
		* @param url The URL to request
		* @param method The request method
		* @param body The request body
		* @param config The request configuration
		* @returns An observable with the request result
		* @remark If injected with RetryHttpService, this method will automatically retry the request if it fails, using settings from config files
		*/
	protected executeRequest(url: string, method: RequestMethod, body: any, config: any): Observable<any> {
		const methodString = RequestMethod[method].toLowerCase(); // get method as string from RequestMethod enum; convert to lowercase to match HttpService method names
		return methodString === 'get' ? this.httpService.get(url, config) : (this.httpService as any)[methodString](url, body, config);
	}

	/** Refresh access token using refresh token
	 * @returns Promise containing the refresh response, or an error message
	 * @throws Error if the refresh token request fails, or if the response is invalid
	 */
	protected async refresh(): Promise<string> {
		this.logger.log(`${this.constructor.name}.refresh Refreshing access token...`);
		
		// set up data for request
		const appConfig = this.config.get('app') ?? {} as AppConfig;
		const authServiceConfig = this.config.get('services.fitnessapp-authentication-service') ?? {} as ServiceConfig;
		const refreshConfig = authServiceConfig?.endpoints?.serviceRefresh ?? {} as EndPointConfig;				
		const url = authServiceConfig.baseURL.href + refreshConfig.path;		
		const body = <ServiceTokenRefreshDataDTO>{
			serviceId: appConfig.serviceid,
			serviceName: appConfig.servicename,
			refreshToken: this._refreshToken // note: this presumes a bug fix in the auth service DTO
		};		
		const options = {
			headers: {
				authorization: `Bearer ${this._refreshToken}` // note: this presumes a bug fix in the auth service
			}
		}
		
		// execute the request
		const method = RequestMethod[refreshConfig?.method?.toUpperCase()] as unknown as RequestMethod;
		const response$ = this.executeRequest(url, method, body, options);
		const response = await firstValueFrom(response$);

		// validate the response
		if (!response || response.status !== 200) {
			const errorMsg = `${this.constructor.name}.refresh Refresh request failed`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		if (!response.data) {
			const errorMsg = `${this.constructor.name}.refresh Refresh response empty`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		// sanitize the token
		let accessToken: string;
		try {
			const accessTokenDTO = new JwtDTO(response.data?.accessToken);
			accessToken = accessTokenDTO.value as string;
		}
		catch (error) {
			const errorMsg = `${this.constructor.name}.refresh Refresh response invalid: ${error.message}`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}
		
		// validate the token
		const jwtConfig = this.config.get(`security.authentication.jwt`) ?? {};
		if (!jwt.verify(accessToken, jwtConfig.accessToken.secret)) {
			const errorMsg = `${this.constructor.name}.refresh Access token verification failed`;
			this.logger.error(errorMsg);
			throw new Error(errorMsg);
		}

		// log the response
		this.logger.log( `${this.constructor.name}.refresh Access token refresh successful, new access token received and verified`);

		// return the new access token
		return accessToken;
	}
}

export default TokenService;