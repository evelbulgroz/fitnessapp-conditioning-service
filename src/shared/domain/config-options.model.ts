import SecurityConfig from "../../domain/security.config.model";

/* Specifies supported options for the ConfigModule */
export interface ConfigOptions {
	environment: 'development' | 'test' | 'production';
	app: AppConfig;	
	modules :	{
		conditioning: {
			repos: {
				fs: {
					/* Path to the directory containing the user json files */
					dataDir: string;
					/** Internal queue for processing of CRUD commands */
					commandQueue: {
						/** Worker processing the command queue */
						worker: {
							/* Time in ms to wait between processing items (default is 100ms) */
							throttleTime: number;
						}
					}
				}
			}
		},
		user: {
			repos: {
				fs: {
					/* Path to the directory containing the user json files */
					dataDir: string;
					/** Internal queue for processing of CRUD commands */
					commandQueue: {
						/** Worker processing the command queue */
						worker: {
							/* Time in ms to wait between processing items (default is 100ms) */
							throttleTime: number;
						}
					}
				}
			}
		},
		
	},

	/** Microservice endpoints ordered by service name */
	services: { [key: string]: ServiceConfig },
	
	/** Configuration for service authentication and verification */
	security: SecurityConfig;
}

/** Configuration for this micro service */
export interface AppConfig {
	/** Base URL for this micro service (including protocol, port, excluding path/prefix) */
	baseURL: URL;

	/** Prefix for all routes in the microservice, including API version (e.g. 'auth/api/v1') */
	globalprefix: string;
	
	/** Unique identifier for current instance of the micro service */
	serviceid: string;

	/** Name of the service used in the service registry (lower-case only) */
	servicename: string;
	
	/** API version of the service (major version only) */
	version: string | number;
}

/** Configuration for a micro service */
export interface ServiceConfig {
	/** Unique identifier for the micro service (from service registry) */
	id?: string;
	
	/** Base URL for the micro service (including protocol, port, and path) */
	baseURL: URL;

	/** Configuration for connecting and disconnecting from the micro service */
	connect?: {
		/** Max number of connection retries */
		maxRetries?: number;
		/** Time in ms to wait between connection retries */
		retryDelay?: number;
	}
	
	disconnect?: {
		/** Max number of connection retries */
		maxRetries?: number;
		/** Time in ms to wait between connection retries */
		retryDelay?: number;
	}
	
	/** Additional configuration for each micro service endpoint */
	endpoints?: {[key: string]: EndPointConfig}
}

/** Configuration for a micro service endpoint */
export interface EndPointConfig {
	/** Network location of the micro service */
	path: string;

	/** HTTP method for the endpoint */
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	
	/** Configuration for connecting and disconnecting from the endpoint (if different from general service settings) */
	connect?: {
		/** Max number of connection retries */
		maxRetries?: number;
		/** Time in ms to wait between connection retries */
		retryDelay?: number;
	}
	disconnect?: {
		/** Max number of connection retries */
		maxRetries?: number;
		/** Time in ms to wait between connection retries */
		retryDelay?: number;
	}
}



export default ConfigOptions;