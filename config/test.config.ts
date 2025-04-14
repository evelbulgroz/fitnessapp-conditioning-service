import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { LogLevel }  from '@evelbulgroz/logger';

import { ConfigOptions } from "../src/shared/domain/config-options.model";
import testSecurityConfig from "../security-config/test.security.config";

export default async () => {
	// wait for package.json to be imported before trying to access it:
	// importing it directly may cause an error because the file is not yet available
	const packageJson = (await import('../package.json') as any).default as any;
	const majorVersion = parseInt(packageJson.version?.split('.')[0]);
	
	// return the test configuration
	return (<ConfigOptions>{
		environment: 'test',
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
				maxRetries: 3,
				retryDelay: 100 // 1 second
			}
		},
		log: {
			appName: 'App',
			level: 'debug' as LogLevel,
			addLocalTimestamp: true,
			useColors: true
		},
		modules: {
			conditioning: {
				repos: {
					fs: {
						dataDir: path.join('D:\\test-data\\fitnessapp\\conditioning-service\\conditioning-repo\\data'),
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
						dataDir: path.join('D:\\test-data\\fitnessapp\\conditioning-service\\user-repo\\data'),
						commandQueue: {
							worker: {
								throttleTime: 50
							}
						}
					}
				}
			},	
		},
		security: testSecurityConfig(),
		services: {
			'fitnessapp-authentication-service': {
				baseURL: new URL('http://localhost:3010/auth/api/v1'),
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
			'conditioningservice' : {
				baseURL: new URL('http://localhost:3020/conditionings'),			
			},
		}
	});
};