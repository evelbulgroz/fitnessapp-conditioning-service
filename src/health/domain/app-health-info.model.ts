import e from "express";
import AppHealthStatus from "./app-health-status.enum";

/** Type representing the health status of the application */
export type AppHealthInfo = {
	status: AppHealthStatus;
	reason?: string;
};

export default AppHealthInfo;