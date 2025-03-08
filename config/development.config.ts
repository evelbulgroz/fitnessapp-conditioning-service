import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ConfigOptions } from "../src/shared/domain/config-options.model";
import developmentSecurityConfig from "../security-config/development.security.config";
import * as packageJson from '../package.json';
const majorVersion = parseInt(packageJson.version?.split('.')[0]);

export default () => (<ConfigOptions>{
	environment: 'development',
	app: {
		baseURL: new URL('https://localhost:3060/'),
		globalprefix: `api/v${majorVersion}`,
		serviceid: uuidv4(),
		servicename: 'fitnessapp-conditioning-service',
		version: majorVersion
	},	
	modules: {
		conditioning: {
			repos: {
				fs: {
					dataDir: path.join('D:\\development-data\\fitnessapp\\conditioning-service\\conditioning-repo\\data'),
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
					dataDir: path.join('D:\\development-data\\fitnessapp\\conditioning-service\\user-repo\\data'),
					commandQueue: {
						worker: {
							throttleTime: 50
						}
					}
				}
			}
		},	
	},
	security: developmentSecurityConfig(),
	services: {
		'fitnessapp-authentication-service': {
			baseURL: new URL('https://localhost:3010/auth/api/v1'),
			connect: {
				maxRetries: 1,
				retryDelay: 1000 // 1 second
			},
			disconnect: {
				maxRetries: 1,
				retryDelay: 1000 // 1 second
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
			baseURL: new URL('https://localhost:3000/registry/api/v1'),
			connect: {
				maxRetries: 1,
				retryDelay: 1000 // 1 second
			},
			disconnect: {
				maxRetries: 1,
				retryDelay: 1000 // 1 second
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
		'fitnessapp-user-service': {
			baseURL: new URL('https://localhost:3000/registry/api/v1'),
			connect: {
				maxRetries: 1,
				retryDelay: 1000 // 1 second
			},
			disconnect: {
				maxRetries: 1,
				retryDelay: 1000 // 1 second
			},
			endpoints: {
				fetchUser: {
					path: '/bootstrap',
					method: 'GET'
				},
			}
		},
	}
});