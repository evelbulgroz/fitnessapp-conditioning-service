import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ConfigOptions } from "../src/domain/config-options.model";
import productionSecurityConfig from "../security-config/production.security.config";
import * as packageJson from '../package.json';

const majorVersion = parseInt(packageJson.version?.split('.')[0]);

export default () => (<ConfigOptions>{
	environment: 'production',
	app: {
		baseURL: new URL('http://localhost:3060/'),
		globalprefix: `api/v${majorVersion}/conditioning`,
		serviceid: uuidv4(),
		servicename: 'fitnessapp-conditioning-service',
		version: majorVersion
	},	
	modules: {
		conditioning: {
			repos: {
				fs: {
					dataDir: path.join('D:\\production-data\\fitnessapp\\conditioning-service\\fs-conditioning-repo\\data'),
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
					dataDir: path.join('D:\\production-data\\fitnessapp\\conditioning-service\\fs-user-repo\\data'),
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
			baseURL: new URL('http://localhost:3010/auth/api/v1'),
			connect: {
				maxRetries: 1,
				retryDelay: 10 * 1000 // 10 seconds
			},
			disconnect: {
				maxRetries: 6,
				retryDelay: 10 * 1000 // 10 seconds
			},
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
			baseURL: new URL('http://localhost:3000/registry/api/v1'),
			connect: {
				maxRetries: 6,
				retryDelay: 10 * 1000 // 10 seconds
			},
			disconnect: {
				maxRetries: 6,
				retryDelay: 10 * 1000 // 10 seconds
			},
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