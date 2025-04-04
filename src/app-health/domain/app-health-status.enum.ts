/** List of possible application health statuses.*/
export enum AppHealthStatus {
	OK = 'OK',
	DEGRADED = 'DEGRADED',
	UNAVAILABLE = 'UNAVAILABLE',
	INITIALIZING = 'INITIALIZING',
	SHUTTING_DOWN = 'SHUTTING_DOWN',
}

export default AppHealthStatus;