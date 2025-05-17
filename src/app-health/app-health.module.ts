import { Module } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';
import ModuleStateHealthIndicator from './health-indicators/module-state-health-indicator';

@Module({
	controllers: [ AppHealthController ],
	providers: [
		AppHealthService,
		HealthIndicatorService,
		ModuleStateHealthIndicator,
	],
	exports: [
		AppHealthService,
		HealthIndicatorService,
		ModuleStateHealthIndicator,
	],
})
export class AppHealthModule {}
export default AppHealthModule;
