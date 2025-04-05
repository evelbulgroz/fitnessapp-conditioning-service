import { Module } from '@nestjs/common';

import { ConsoleLogger, Logger } from '@evelbulgroz/ddd-base';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';

@Module({
	controllers: [ AppHealthController ],
	providers: [
		{
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
