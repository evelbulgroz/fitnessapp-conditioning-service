import { Module } from '@nestjs/common';

import { ConsoleLogger, Logger } from '@evelbulgroz/logger';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';

@Module({
	controllers: [ AppHealthController ],
	providers: [
		{ // Logger (suppress console output)
			provide: Logger,
			useValue: {
				log: jest.fn(),
				error: jest.fn(),
				warn: jest.fn(),
				debug: jest.fn(),
				verbose: jest.fn(),
			},
		},
		AppHealthService,
	],
	exports: [
		AppHealthService,
	],
})
export class AppHealthModule {}
