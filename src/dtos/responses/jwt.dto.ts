import jwt from 'jsonwebtoken';

import { InRange, IsDefined, IsString, Matches } from "@evelbulgroz/sanitizer-decorator";

import { SafePrimitive } from './safe-primitive.class';

/** DTO for sanitizing a single JWT string in a response */
export class JwtDTO extends SafePrimitive<string> {
	// _value is inherited from SafePrimitive
	
	public constructor(value: string) {		
		super();
		this.value = value;
	}

	@IsDefined(undefined, { message: 'Token must be defined' })
	@IsString()
	@InRange({min: 20, max: 1024}, { inclusive: true, message: 'Token must be between 20 and 1024 characters' })
	@Matches(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, { message: 'Token must include 3 base64-encoded parts separated by periods' })
	public set value(value: string) {
		console.debug('JwtDTO.value', value);
		try {
			jwt.decode(value);
		}
		catch {
			throw new Error('Token must be a valid JWT');
		}
		this._value = value;
	}
	
	public get value(): string {
		return this._value;
	}
}

export default JwtDTO;