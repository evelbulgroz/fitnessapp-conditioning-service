import { Module } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckService, HealthIndicatorService, MemoryHealthIndicator, TerminusModule } from '@nestjs/terminus';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';
import ModuleStateHealthIndicator from './health-indicators/module-state-health-indicator';
import { HealthCheckExecutor } from '@nestjs/terminus/dist/health-check/health-check-executor.service';

const noopLogger = () => {}; // This function does nothing

@Module({
	imports: [
		TerminusModule.forRoot({
			logger: false, // Disable the default logger
		  }),
	],
	controllers: [ AppHealthController ],
	providers: [
		AppHealthService,
		DiskHealthIndicator,
		HealthCheckService,
		HealthCheckExecutor,
		HealthIndicatorService,
		MemoryHealthIndicator,
		ModuleStateHealthIndicator,
		{ // TERMINUS_LOGGER
			provide: 'TERMINUS_LOGGER',
			useValue: noopLogger, // Use our no-op function
		},
		{ // TERMINUS_ERROR_LOGGER
			provide: 'TERMINUS_ERROR_LOGGER',
			useValue: noopLogger,
		},
	],
	exports: [
		AppHealthService,
		HealthIndicatorService,
		ModuleStateHealthIndicator,
	],
})
export class AppHealthModule {}
export default AppHealthModule;
