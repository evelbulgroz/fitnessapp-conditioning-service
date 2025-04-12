import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable, RequestMethod } from '@nestjs/common';

import { firstValueFrom, from, Observable, switchMap, tap } from 'rxjs';

import { Logger } from '@evelbulgroz/logger';
import { ServiceDataDTO as RegistryServiceDataDTO } from '../../dtos/responses/service-data.dto';

import { AuthService } from '../../domain/auth-service.class';
import { ServiceConfig, EndPointConfig, DefaultConfig } from '../../../shared/domain/config-options.model';

/** Service for de/registering a running instance of this app with the microservice registry */
@Injectable()
export class RegistrationService {
	private readonly appConfig: any;
	private readonly registryServiceName: string = 'fitnessapp-registry-service';
	
	public constructor(		
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly logger: Logger,
		private readonly http: HttpService,
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
				return this.executeRequest(url, RequestMethod[endpointConfig.method!], body, config) // execute the request
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
				return this.executeRequest(url, RequestMethod[endpointConfig.method!], body, config) // execute the request
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
		return methodString === 'get' ? this.http.get(url, config) : (this.http as any)[methodString](url, body, config);
	}
		
}
export default RegistrationService;