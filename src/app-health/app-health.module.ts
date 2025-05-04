import { Module } from '@nestjs/common';

import AppHealthController from './controllers/app-health.controller';
import AppHealthService from './services/health/app-health.service';

@Module({
	controllers: [ AppHealthController ],
	providers: [
		AppHealthService,
	],
	exports: [
		AppHealthService,
	],
})
export class AppHealthModule {}
export default AppHealthModule;
