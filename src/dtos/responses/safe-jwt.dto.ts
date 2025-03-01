import jwt from 'jsonwebtoken';

import { InRange, IsDefined, IsString, Matches } from "@evelbulgroz/sanitizer-decorator";

import { ParamDTO } from "./param.dto";

/** Class for a single, sanitized boolean value received by an endpoint in a query parameter.
 * @remark Allows for validation of a boolean value received by an endpoint in a query parameter.
 * @remark Accepts undefined as a valid value, but not null.
 */
export class SafeJwtDTO extends ParamDTO<string> {
	// _value is inherited from ParamDTO
	
	public constructor(value?: string) {		
		super(value);
	}

	@IsDefined(undefined, { message: 'Token must be defined' })
	@IsString()
	@InRange({min: 20, max: 1024}, { inclusive: true, message: 'Token must be between 20 and 1024 characters' })
	@Matches(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, { message: 'Token must include 3 base64-encoded parts separated by periods' })
	public set value(value: string | undefined) {
		if (value) {
			try {
				jwt.decode(value as string);
			}
			catch {
				throw new Error('Token must be a valid JWT');
			}
		}		
		this._value = value;
	}
	public get value(): string | undefined { return this._value; }
}

export default SafeJwtDTO;