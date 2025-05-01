import { Injectable } from '@nestjs/common';
import { ConsoleLogger, LogLevel } from '@evelbulgroz/logger';

/** Wrapper class for ConsoleLogger
 * Enables NestJS-specific extensions while maintaining compatibility with libraries expecting a ConsoleLogger.
 */
@Injectable()
export class NestLogger extends ConsoleLogger {
	constructor(
		logLevel: LogLevel = 'debug',
		appName: string = 'App',
		context?: string,
		addLocalTimestamp: boolean = true,
		useColors: boolean = true
	) {
		super(logLevel, appName, context, addLocalTimestamp, useColors);
	}	

  // Add any additional NestJS-specific methods or overrides as needed

	/* TODO: Add combined UTC and local timestamp to all log messages in base class
	protected getUtcTimestamp(): string {
		return new Date().toISOString(); // ISO 8601 format in UTC
	}

		protected getLocalTimestamp(): string {
		return new Date().toLocaleString(); // Local time in the server's timezone
	}
	*/
}
export default NestLogger;