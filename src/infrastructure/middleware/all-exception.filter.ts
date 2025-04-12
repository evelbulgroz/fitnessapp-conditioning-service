import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

import { ConsoleLogger, Logger } from '@evelbulgroz/logger';

/** Middleware to catch all exceptions and log them
 * @remark This is a global exception filter
 * @todo Add a logger service to log exceptions
 * @todo Use to replace exception handling in controllers
 * @example main.ts:
 * async function bootstrap() {
 *     const app = await NestFactory.create(AppModule);
 *     app.useGlobalFilters(new AllExceptionsFilter()); // Add this line
 *     await app.listen(3000);
 * }
 * bootstrap();
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new ConsoleLogger('debug', AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const status = exception instanceof HttpException ? exception.getStatus() : 500;

		const errorResponse = {
		statusCode: status,
		timestamp: new Date().toISOString(),
		path: request.url,
		message: exception instanceof HttpException ? exception.message : 'Internal server error',
		};

		if (status === 500) {
		this.logger.error(`Internal server error: ${exception}`);
		} else {
		this.logger.warn(`HTTP ${status} Error: ${exception}`);
		}

		response.status(status).json(errorResponse);
	}
}

export default AllExceptionsFilter;