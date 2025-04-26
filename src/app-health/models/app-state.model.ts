import { ComponentState } from "./component-state.enum";

/** Specifies supported overall app health states with respect to readiness to serve requests.
 * @remarks The state should default to UNINITIALIZED when the app is created, and updated as needed
 * @remarks State INITIALIZING may also be used to prevent multiple, overlapping initializations
 * @remarks State SHUTTING_DOWN may also be used to prevent multiple, overlapping shutdowns
 * @remarks For now, just an alias for ComponentState, but may be extended in the future.
 */

export type AppState = ComponentState;
export default AppState;
