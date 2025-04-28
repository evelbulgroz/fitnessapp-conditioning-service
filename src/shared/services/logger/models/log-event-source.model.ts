/** Represents the source of a log event */
export enum LogEventSource {
	LOG = 'log',
	REPO = 'repo',
	STATE = 'state',
	CUSTOM = 'custom'
	// Add other sources as needed...
}

export default LogEventSource;