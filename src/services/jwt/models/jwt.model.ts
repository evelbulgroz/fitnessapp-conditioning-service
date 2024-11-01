import { JwtHeader } from "./jwt-header.model";
import { JwtPayload } from "./jwt-payload.model";

/** Specifies a complete JSON Web Token payload, including header and signature, as defined by the JWT specification.
 * @remarks Mimics the JwtHeader interface from the '@nestjs/jwt' package but avoids the dependency.
 */
export interface Jwt {
    header: JwtHeader;
    payload: JwtPayload | string;
    signature: string;
}

export default Jwt;