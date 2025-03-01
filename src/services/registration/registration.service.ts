import { Injectable, RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { firstValueFrom, from, switchMap, tap } from "rxjs";

import { Logger } from "@evelbulgroz/ddd-base";
import { ServiceDataDTO as RegistryServiceDataDTO } from "../../dtos/responses/service-data.dto";

import { AuthService } from "../auth/auth-service.class";
import { RetryRequesterService } from "../retry-requester/retry-requester.service";
import { ServiceConfig, EndPointConfig } from "../../domain/config-options.model";

/** Service for de/registering a running instance of this app with the microservice registry */
@Injectable()
export class RegistrationService {
	private readonly appConfig: any;
	private readonly registryServiceName: string = 'fitnessapp-registry-service';
	
	public constructor(		
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly logger: Logger,
		private readonly requester: RetryRequesterService,
	) {
		this.appConfig = this.configService.get<any>('app') ?? {};
	}

	/* Deregister this instance from the microservice registry and log out of the auth service
	 * @returns true if deregistration was successful, otherwise throws an error
	 * @throws Error if the deregistration request fails
	 * @remark Will recursively retry the request if it fails, up to the maximum number of attempts specified in config
	 * @todo Log out of the auth microservice after deregistering when supported by Auth/TokenService
	 */
	public async deregister(): Promise<boolean> {
		this.logger.log('Deregistering service from the microservice registry...');//, `${this.constructor.name}.deregister`);

		// set up data for request
		const registryConfig = this.configService.get<ServiceConfig>(`services.${this.registryServiceName}`) ?? {} as ServiceConfig;
		const endpointConfig = registryConfig?.endpoints?.deregister ?? {} as EndPointConfig;
		const MAX_RETRIES = endpointConfig.connect?.maxRetries ?? registryConfig?.connect?.maxRetries ?? 0;
		const RETRY_DELAY = endpointConfig.connect?.retryDelay ?? registryConfig?.connect?.retryDelay ?? 0;		
		
		const url = registryConfig.baseURL.href + endpointConfig.path;
		const body = {
			serviceId: this.appConfig.serviceid,
			serviceName: this.appConfig.servicename,
			location: this.appConfig.baseURL.href
		} as RegistryServiceDataDTO;
		let config: {[key: string]: any};

		// get the access credential from the auth service, then execute the request
		const response$ = from(this.authService.getAuthData()).pipe( // get the auth data
			switchMap((authData) => { // switch to the request once auth data is available
				config = {
					headers: {
						authorization: `Bearer ${authData}` // access token
					}
				};
				return this.requester.execute(url, RequestMethod[endpointConfig.method!], body, config, MAX_RETRIES, RETRY_DELAY) // execute the request
					.pipe(
						tap((response) => {
							this.logger.log(`Service deregistration successful: ${response}`);//, `${this.constructor.name}.deregister`);
						})
					)
			})
		);
		const response = await firstValueFrom(response$);

		// validate the response
		if (!response || response.status !== 200) {
			this.logger.error('Deregistration request failed');//, `${this.constructor.name}.deregister`);
			throw new Error('Deregistration request failed');
		}

		// log the response
		this.logger.log(`Service deregistration successful: ${response.status}`);//, `${this.constructor.name}.deregister`);

		// return true if successful
		return true;
	}

	/* Register this instance with the microservice registry
	 * @returns true if registration was successful, otherwise throws an error
	 * @throws Error if the registration request fails
	 * @remark Will recursively retry the request if it fails, up to the maximum number of attempts specified in config
	 */
	public async register(): Promise<boolean> {
		this.logger.log('Registering service with the microservice registry...');//, `${this.constructor.name}.register`);

		// set up data for request
		const registryConfig = this.configService.get<ServiceConfig>(`services.${this.registryServiceName}`) ?? {} as ServiceConfig;
		const endpointConfig = registryConfig?.endpoints?.register ?? {} as EndPointConfig;
		const MAX_RETRIES = endpointConfig.connect?.maxRetries ?? registryConfig?.connect?.maxRetries ?? 0;
		const RETRY_DELAY = endpointConfig.connect?.retryDelay ?? registryConfig?.connect?.retryDelay ?? 0;
		
		const url = registryConfig.baseURL.href + registryConfig.endpoints?.register.path;
		const body ={
			serviceId: this.appConfig.serviceid,
			serviceName: this.appConfig.servicename,
			location: this.appConfig.baseURL.href
		} as RegistryServiceDataDTO;
		let config: {[key: string]: any};

		// get the access credential from the auth service, then execute the request
		const response$ = from(this.authService.getAuthData()).pipe( // get the auth data
			switchMap((authData) => { // switch to the request once auth data is available
				config = {
					headers: {
						authorization: `Bearer ${authData}` // access token
					}
				};
				return this.requester.execute(url, RequestMethod[endpointConfig.method!], body, config, MAX_RETRIES, RETRY_DELAY) // execute the request
					.pipe(
						tap((response) => {
							this.logger.log(`Service registration successful: ${response.status}`);//, `${this.constructor.name}.register`);
						})
					)
			})
		);
		const response = await firstValueFrom(response$);
		
		// validate the response
		if (!response || response.status !== 200) {
			this.logger.error('Registration request failed');//, `${this.constructor.name}.register`);
			throw new Error('Registration request failed');
		}

		// log the response
		this.logger.log(`Service registration successful: ${response.status}`);//, `${this.constructor.name}.register`);

		// return true if successful
		return true;
	}
}
