import { Logger, LogLevel } from './logger'

/** Console logger emulating the NestJS logger without introducing a dependency on NestJS.
 * @remark This logger uses ANSI escape codes for colored output if supported by the terminal.
 * @remark Internally uses the standard JavaScript `console` which should make it integrate well with Docker and similar process managers.
 * @see Logger base class for details on the logging methods and their intended use.
 * @see LogLevel for details on the log levels and their severity.
 */
export class ConsoleLogger extends Logger {
	//------------------------------ CONSTANTS ------------------------------//

	private RESET = "\x1b[0m";
	private BOLD = "\x1b[1m";
	private DIM = "\x1b[2m";
	private RED = "\x1b[31m";
	private GREEN = "\x1b[32m";
	private YELLOW = "\x1b[33m";
	private BLUE = "\x1b[34m";
	private CYAN = "\x1b[36m";
	private MAGENTA = "\x1b[35m";
	private WHITE = "\x1b[37m";
	// Add more escape codes as needed, see https://en.wikipedia.org/wiki/ANSI_escape_code#Colors

	//------------------------------ PROPERTIES -----------------------------//

	private useColors: boolean;

	//------------------------------ CONSTRUCTOR ----------------------------//

	/** Constructor for the ConsoleLogger class.
	 * @param context The default context of the logger (optional).
	 * @param logLevel The log level of the logger (default is 'debug').
	 * @param useColors Whether to use ANSI escape codes for colored output (default is true if stdout is a TTY).
	 */
	constructor(
		logLevel: LogLevel = 'debug',
		appName: string = 'App',
		context?: string,
		useColors: boolean = process.stdout.isTTY,
	) {
		super(logLevel, appName, context);
		this.useColors = useColors;
	}

	//------------------------------ PUBLIC API -----------------------------//

	public log(message: string, context?: string) {
		if (this.shouldLog('log')) {
			console.log(this.formatMessage('LOG', message, context, this.GREEN));
		}
	}

	public warn(message: string, context?: string) {
		if (this.shouldLog('warn')) {
			console.log(this.formatMessage('WARN', message, context, this.YELLOW));
		}
	}

	public error(message: string, trace?: string, context?: string) {
		if (this.shouldLog('error')) {
			console.log(
				this.formatMessage('ERROR', message, context, this.RED + this.BOLD) +
				(trace ? `\n${this.applyStyle(trace, this.DIM)}` : '')
			);
		}
	}

	public info(message: string, context?: string) {
		if (this.shouldLog('info')) {
			console.log(this.formatMessage('INFO', message, context, this.CYAN));
		}
	}

	public debug(message: string, context?: string) {
		if (this.shouldLog('debug')) {
			console.log(this.formatMessage('DEBUG', message, context, this.MAGENTA));
		}
	}

	public verbose(message: string, context?: string) {
		if (this.shouldLog('verbose')) {
			console.log(this.formatMessage('VERBOSE', message, context, this.BLUE));
		}
	}

	//---------------------------PROTECTED METHODS --------------------------//
	
	/* Format the log message with ANSI escape codes for colored output (if supported).
   * @param level The log level of the message.
   * @param message The message to log.
   * @param context The context of the log message (optional).
   * @param color The ANSI escape code for the color (default is white).
   * @returns The formatted log message.
   */
	protected formatMessage(level: string, message: string, context?: string, color: string = this.WHITE): string {
		const appName = this.applyStyle(`[${this.appName}]`, this.GREEN); // Application name
		const processId = this.applyStyle(`${process.pid}`, this.GREEN); // Process ID
		const timestamp = this.applyStyle(this.getTimestamp(), this.WHITE); // Timestamp
		const levelTag = this.applyStyle(`${level}`, color); // Log level
		const formattedContext = this.formatContext(context); // Context
		const formattedMessage = this.applyStyle(message, color); // Message
		const composedMessage = `${appName} ${processId} ${this.applyStyle('-', this.GREEN)} ${timestamp}   ${levelTag} ${formattedContext} ${formattedMessage}`;
		
		// return the composed message with ANSI escape codes for colored output (if supported)
		return composedMessage;
	}

	/* Format the context of the log message using the default text color.
	 * @param context The context of the log message (optional).
	 * @returns The formatted context string.
	 */
	protected formatContext(context?: string): string {
		const effectiveContext = context || this.context;
		return effectiveContext ? this.applyStyle(`[${effectiveContext}]`, this.YELLOW) : '';
	}

	/* Apply ANSI escape codes to the text for colored output (if supported).
	 * @param text The text to apply the style to.
	 * @param style The ANSI escape code for the style.
	 * @returns The styled text.
	 * @remark If colors are not supported, the text is returned as is.
	 */
	private applyStyle(text: string, style: string): string {
		return this.useColors ? `${style}${text}${this.RESET}` : text;
	}
}

export default ConsoleLogger;