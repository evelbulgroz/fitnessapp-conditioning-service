import { Logger, Injectable } from '@nestjs/common';

/** NestJS Logger that logs all messages in both UTC and local format, regardless of the server's timezone.
 * @extends Logger
 */
@Injectable()
export class UtcLogger extends Logger {
	protected appName: string;
	protected logLevel: 'debug' | 'log' | 'info' | 'warn' | 'error' | 'verbose';
	
	protected formatTimestamp(context?: string): string {
		const utcTimestamp = this.getUtcTimestamp();
		const localTimestamp = this.getLocalTimestamp();
		return context
			? `[${context}] ${utcTimestamp} (${localTimestamp})`
			: `${utcTimestamp} (${localTimestamp})`;
	}

	info(message: string, context?: string) {
		console.info(message, this.formatTimestamp(context));
	}

	log(message: string, context?: string) {
		super.log(message, this.formatTimestamp(context));
	}

	warn(message: string, context?: string) {
		super.warn(message, this.formatTimestamp(context));
	}

	error(message: string, trace?: string, context?: string) {
		super.error(message, trace, this.formatTimestamp(context));
	}

	debug(message: string, context?: string) {
		super.debug(message, this.formatTimestamp(context));
	}

	verbose(message: string, context?: string) {
		super.verbose(message, this.formatTimestamp(context));
	}
	
	protected getUtcTimestamp(): string {
		return new Date().toISOString(); // ISO 8601 format in UTC
	}

	protected getLocalTimestamp(): string {
		return new Date().toLocaleString(); // Local time in the server's timezone
	}

	/* Get the current timestamp in ISO format.
	 * @returns The current timestamp as a string.
	 */
	protected getTimestamp(): string {
		return new Date().toISOString();
	}

	/* Check if the log level is enabled for the current message.
	 * @param level The log level to check.
	 * @returns true if the log level is enabled, false otherwise.
	 */
	protected shouldLog(level: string): boolean {
		const levels = ['verbose', 'debug', 'log', 'info', 'warn', 'error'];
		return levels.indexOf(level) >= levels.indexOf(this.logLevel);
	}	
}
export default UtcLogger;