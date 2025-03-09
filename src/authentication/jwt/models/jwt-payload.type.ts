import { Jwt } from "./jwt.model";
import { JwtPayload } from "./jwt-payload.model";

/** type alias for the return type of the JWT decode and verify methods */
export type JwtPayloadType = Jwt | JwtPayload | string;

export default JwtPayloadType;