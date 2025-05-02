import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Res, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Response } from 'express';

import AppHealthService from '../services/health/app-health.service';
import { ComponentState as AppState} from '../../libraries/managed-stateful-component/index';
import DefaultStatusCodeInterceptor from '../../infrastructure/interceptors/status-code.interceptor';
import JwtAuthGuard from '../../infrastructure/guards/jwt-auth.guard';
import LoggingGuard from '../../infrastructure/guards/logging.guard';
import Public from '../../infrastructure/decorators/public.decorator';
import Roles from '../../infrastructure/decorators/roles.decorator';
import RolesGuard from '../../infrastructure/guards/roles.guard';
import ValidationPipe from '../../infrastructure/pipes/validation.pipe';

/** Controller for serving health check requests
 * @remark This controller is used to check the health of the micoservice, e.g. by load balancers or monitoring tools.
 * @todo Add a status page that shows the health of all services and dependencies
 */
@ApiTags('health')
@Controller('health') // version prefix set in main.ts
@Roles('admin', 'user')
@UseGuards(
	JwtAuthGuard, // require authentication of Jwt token
	RolesGuard, // require role-based access control
	LoggingGuard // log all requests to the console
	// todo: add rate limiting guard (e.g. RateLimitGuard, may require external package)
)
@UseInterceptors(new DefaultStatusCodeInterceptor(200)) // Set default status code to 200
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) // whitelisting ignored with primitive types
export class AppHealthController {
	constructor(private readonly appHealthService: AppHealthService) {}

	// Health check: Returns 200 if healthy, 503 if degraded/unavailable
	@Get()
	@Public() // debug: disable authentication during development
	@ApiOperation({
		summary: 'Health check',
		description: 'Returns HTTP 200 if the app is healthy, HTTP 503 if degraded/unavailable. Used by load balancers and monitoring tools. Also returns the health status and reason for unavailability in the response body.'
	})
	@ApiResponse({ status: 200, description: 'The app is healthy' })
	async checkHealth(@Res() res: Response) {
		const { state, reason } = await this.appHealthService.getState();
		
		if (state as unknown as AppState === AppState.OK) {
			res.status(HttpStatus.OK).send({ state });
		} else {
			res.status(HttpStatus.SERVICE_UNAVAILABLE).send({ state, reason });
		}
	}

	@Get('/readiness')
	public async isReady(): Promise<{ status: string; details?: any }> {
		const state = await this.appHealthService.getState();
		const status = state.state === AppState.OK ? 'healthy' : 'unhealthy';
		return { status, details: state };
	}
	
	// Liveness check: Simply returns HTTP 200 if the app is running
	@Get('liveness')
	@Public() // debug: disable authentication during development
	@ApiOperation({
		summary: 'Liveness check',
		description: 'Returns HTTP 200 if the app is running. Used by load balancers and monitoring tools.'
	})
	@ApiResponse({ status: 200, description: 'The app is running' })
	checkLiveness(@Res() res: Response) {
		res.status(HttpStatus.OK).send({ alive: true });
	}

	
}
export default AppHealthController;