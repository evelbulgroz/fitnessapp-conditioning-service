import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { LogLevel }  from '@evelbulgroz/logger';

import { ConfigOptions } from "../src/shared/domain/config-options.model";
import productionSecurityConfig from "../security-config/production.security.config";
import * as packageJson from '../package.json';

const majorVersion = parseInt(packageJson.version?.split('.')[0]);

export default () => (<ConfigOptions>{
	environment: 'production',
	app: {
		baseURL: new URL('https://localhost:3060/'),
		globalprefix: `api/v${majorVersion}`,
		serviceid: uuidv4(),
		servicename: 'fitnessapp-conditioning-service',
		version: majorVersion
	},
	defaults: {
		commandQueue: {
			throttleTime: 50
		},
		retry: {
			maxRetries: 1,
			retryDelay: 1000 // 1 second
		}
	},	
	log: {
		appName: 'App',
		level: 'log' as LogLevel,
		addLocalTimestamp: true,
		useColors: true
	},
	modules: {
		conditioning: {
			repos: {
				fs: {
					dataDir: path.join('D:\\production-data\\fitnessapp\\conditioning-service\\conditioning-repo\\data'),
					commandQueue: {
						worker: {
							throttleTime: 50
						}
					}
				}
			}
		},
		user: {
			repos: {
				fs: {
					dataDir: path.join('D:\\production-data\\fitnessapp\\conditioning-service\\user-repo\\data'),
					commandQueue: {
						worker: {
							throttleTime: 50
						}
					}
				}
			}
		},	
	},
	security: productionSecurityConfig(),
	services: {
		'fitnessapp-authentication-service': {
			baseURL: new URL('https://localhost:3010/auth/api/v1'),
			endpoints: {
				serviceRefresh: {
					path: '/service/refresh',
					method: 'POST'
				},
				serviceLogin: {
					path: '/service/login',
					method: 'POST'
				},
				serviceLogout: {
					path: '/service/logout',
					method: 'POST'
				},
			}
		},
		'fitnessapp-registry-service': {
			baseURL: new URL('https://localhost:3000/registry/api/v1'),
			endpoints: {
				bootstrap: {
					path: '/bootstrap',
					method: 'GET'
				},
				deregister: {
					path: '/deregister',
					method: 'POST'
				},
				locate: {
					path: '/locate',
					method: 'POST'
				},
				register: {
					path: '/register',
					method: 'POST'
				},
			}
		},
	}
});