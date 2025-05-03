import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";

import { Observable,  tap } from "rxjs";

import { Logger, LogLevel, LogEventSource, UnifiedLogEntry } from "../../libraries/stream-loggable";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
	constructor(
		private readonly logger: Logger
	) {}
	
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const controller = context.getClass();
		const request = context.switchToHttp().getRequest();
		const user = request.user;
		const method = request.method;
		const url = request.url;

		
		// Log at the start of the request
		this.processLogEntry({
			level: LogLevel.INFO,
			message: `User ${user?.userName || 'unknown'} (${user?.userId ?? 'unknown id'}) accessed ${method} ${url}`,
			context: controller.name,
			timestamp: new Date(),
			source: LogEventSource.LOG
		});

		// Also log response timing and status
		const now = Date.now();
		return next.handle().pipe(
			tap(() => {
				const responseTime = Date.now() - now;
				this.processLogEntry({
					level: LogLevel.DEBUG,
					message: `${method} ${url} completed in ${responseTime}ms`,
					context: controller.name,
					timestamp: new Date(),
					source: LogEventSource.LOG
				});
			})
		);
	}

	/* Log unified log event using the logger provided in LoggingModule */
	protected processLogEntry(entry: UnifiedLogEntry): void {
		switch (entry.level) {
			case LogLevel.ERROR:
				this.logger.error(entry.message, entry.data, entry.context);
				break;
			case LogLevel.WARN:
				this.logger.warn(entry.message, entry.context);
				break;
			case LogLevel.INFO:
				this.logger.info(entry.message, entry.context);
				break;
			case LogLevel.DEBUG:
				this.logger.debug(entry.message, entry.context);
				break;
			case LogLevel.VERBOSE:
				this.logger.verbose(
					`${entry.message}${entry.data ? `, ${JSON.stringify(entry.data)}` : ''}`, 
					entry.context
				);
				break;
			case LogLevel.LOG:
			default:
				this.logger.log(entry.message, entry.context);
				break;
		}
	}
}

export default RequestLoggingInterceptor;