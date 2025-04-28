/** Specifies options for the MergedStreamLogger class. */
export interface MergedStreamLoggerOptions {
	/** Maximum number of consecutive failures before reducing error log frequency (default: 5) */
	maxFailures?: number;
	
	/** Time in milliseconds after which failure counts are automatically reset (default: 60000) */
	backoffResetMs?: number;
	
	/** Whether to log recovery messages when a stream starts working again after failures (default: true) */
	logRecoveryEvents?: boolean;
	
	/** Whether to log warnings when no mapper is found for a stream type (default: true) */
	warnOnMissingMappers?: boolean;
}
export default MergedStreamLoggerOptions;