import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppHealthService } from '../services/health/app-health.service';
import { AppHealthStatus } from '../domain/app-health-status.enum';
import exp from 'constants';

@Controller('health')
export class AppHealthController {
	constructor(private readonly appHealthService: AppHealthService) {}

	// Liveness check: Simply returns HTTP 200 if the app is running
	@Get('liveness')
	checkLiveness(@Res() res: Response) {
		res.status(HttpStatus.OK).send({ alive: true });
	}

	// Health check: Returns 200 if healthy, 503 if degraded/unavailable
	@Get()
	checkHealth(@Res() res: Response) {
		const { status, reason } = this.appHealthService.getState();
		
		if (status === AppHealthStatus.OK) {
			res.status(HttpStatus.OK).send({ status });
		} else {
			res.status(HttpStatus.SERVICE_UNAVAILABLE).send({ status, reason });
		}
	}
}
export default AppHealthController;