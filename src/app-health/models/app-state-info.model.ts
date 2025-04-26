import { ComponentStateInfo } from "./component-state-info.model";

/** Specifies the contents of an overall app health state entry with respect to readiness to serve requests.
 * @remarks The health status is used to determine if the application is lively, and/or healthy, and ready to serve requests.
 * @remarks For now, just an alias for ComponentStateInfo, but may be extended in the future.
 */

export type AppStateInfo = ComponentStateInfo;
export default AppStateInfo;