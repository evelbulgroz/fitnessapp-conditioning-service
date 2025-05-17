import { Module } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckService, HealthIndicatorService, MemoryHealthIndicator, TerminusModule } from '@nestjs/terminus';
import checkDiskSpace from 'check-disk-space';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';
import ModuleStateHealthIndicator from './health-indicators/module-state-health-indicator';
import { HealthCheckExecutor } from '@nestjs/terminus/dist/health-check/health-check-executor.service';

const noopLogger = {
	log: () => {},
	error: () => {},
	warn: () => {},
	debug: () => {},
	verbose: () => {},
	getErrorMessage: (error: any) => error?.message || 'Unknown error',
};

@Module({
	imports: [
		TerminusModule.forRoot({
			logger: false, // Disable the default logger
		  }),
	],
	controllers: [ AppHealthController ],
	providers: [
		AppHealthService,
		{ // DiskHealthIndicator
			provide: DiskHealthIndicator,
			useFactory: (checkLib, healthIndicatorService) => {
			  return new DiskHealthIndicator(checkLib, healthIndicatorService);
			},
			inject: ['CheckDiskSpaceLib', HealthIndicatorService]
		},
		HealthCheckService,
		HealthCheckExecutor,
		HealthIndicatorService,
		MemoryHealthIndicator,
		ModuleStateHealthIndicator,
		{ //CheckDiskSpaceLib
			provide: 'CheckDiskSpaceLib',
			useValue: checkDiskSpace,
		},
		{ // TERMINUS_LOGGER
			provide: 'TERMINUS_LOGGER',
			useValue: noopLogger, // alternatively just set to null or false
		},
		{ // TERMINUS_ERROR_LOGGER
			provide: 'TERMINUS_ERROR_LOGGER',
			useValue: noopLogger, // alternatively just set to null or false
		},
	],
	exports: [ // todo: reconsider if this is needed: these are mostly used in the health controller
		AppHealthService,
		HealthIndicatorService,
		ModuleStateHealthIndicator,
	],
})
export class AppHealthModule {}
export default AppHealthModule;
