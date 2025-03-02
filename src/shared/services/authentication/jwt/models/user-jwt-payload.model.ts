import { JwtPayload } from './jwt-payload.model';

/** Specifies the structure of the payload of a JWT token for a human user in this application.
 * @remark Values of the inherited 'iss' and 'aud' claims should be hashed for security, preventing their exposure through the front end.
 * @todo Import this interface from the authentication microservice when available.
 */
export interface UserJwtPayload extends JwtPayload {
	/** Custom claim: roles of human user making the request (if applicable, in plain text) */
	roles?: string[];
}

export default UserJwtPayload;