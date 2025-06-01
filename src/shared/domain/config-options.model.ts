import { LogLevel } from '@evelbulgroz/logger';
import { SecurityConfig } from './security.config.model';

/* Specifies supported options for the ConfigModule */
export interface ConfigOptions {
	environment: 'development' | 'test' | 'production';
	
	app: AppConfig;

	defaults: DefaultConfig;

	log: LogConfig;
	
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
							throttleTime?: number;
						}
					}
				}
			}
		},
		health: HealthConfig,
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
							throttleTime?: number;
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

export interface DefaultConfig {
	/** Default command queue configuration */
	commandQueue: {
		/** Default time in ms to wait between processing items in the command queue (default is 100ms) */
		throttleTime: number;
	},
	/** Default retry configuration for microservice endpoints */
	retry: RetryConfig;
}

export interface HealthConfig {
	/** Storage configuration for health checks */
	storage: {
		/** Directory where health data is stored */
		dataDir: string;
		/** Maximum storage limit for health data in bytes (% of available storage expressed in decimal) */
		maxStorageLimit: number,		
	},
	/** Memory configuration for health checks */
	memory: {
		/** Maximum size of the heap in bytes */
		maxHeapSize: number,
		/** Maximum size of the RSS (resident set size) in bytes */
		maxRSSsize: number,
	},
	/** Timeouts for health checks */
	timeouts: {
		/** Timeout for /healthz data processing in ms */
		healthz: number;
		/** Timeout for /livenessz data processing in ms */
		livenessz: number;
		/** Timeout for /readinessz data processing in ms */
		readinessz: number;
		/** Timeout for /startupz data processing in ms */
		startupz: number;
	}
}

export interface LogConfig {
	/** Name of the application (mostly used for distinguishing logs from custom code from framework/infrastucture logs ) */
	appName: string;

	/** Log level for the application (e.g. 'debug', 'info', 'warn', 'error') */
	level: LogLevel;

	/** Whether to add a local timestamp to the log output, in addition to the UTC timestamp
	 * Note: This is not the same as the local time zone of the server, but rather the local time of the server where the log is generated
	 */
	addLocalTimestamp: boolean;
	
	/** Whether to use colors in the log output */
	useColors: boolean;
}

/** Configuration for a micro service */
export interface ServiceConfig {
	/** Unique identifier for the micro service (from service registry) */
	id?: string;
	
	/** Base URL for the micro service (including protocol, port, and path) */
	baseURL: URL;

	/** Retry configuration for connecting and disconnecting from the micro service (if different from general service settings) */
	retry?: RetryConfig;
	
	/** Additional configuration for each micro service endpoint */
	endpoints?: {[key: string]: EndPointConfig}
}

/** Configuration for a micro service endpoint */
export interface EndPointConfig {
	/** Network location of the micro service */
	path: string;

	/** HTTP method for the endpoint */
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

	/** Retry configuration for the endpoint (if different from general service settings) */
	retry?: RetryConfig;	
}

/** Retry config for a microservice endpoint */
export interface RetryConfig {
	/** Max number of connection retries */
	maxRetries?: number;
	/** Time in ms to wait between connection retries */
	retryDelay?: number;
}

export default ConfigOptions;