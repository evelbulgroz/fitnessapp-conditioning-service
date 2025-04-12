import { Module } from '@nestjs/common';

import { ConsoleLogger, Logger } from '@evelbulgroz/logger';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';

@Module({
	controllers: [ AppHealthController ],
	providers: [
		{ // Logger
			provide: Logger,
			useClass: ConsoleLogger,
		},
		AppHealthService,
	],
	exports: [
		AppHealthService,
	],
})
export class AppHealthModule {}
