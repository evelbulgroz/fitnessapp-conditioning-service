import jwt from 'jsonwebtoken';
import { SafeJwtDTO } from './safe-jwt.dto';

describe('SafeJwtDTO', () => {
	let token: string;
	beforeEach(() => {
		token = jwt.sign({ data: 'a'.repeat(256) }, 'secret', { expiresIn: '1h' });
	});
	
	it('can be created with valid token', () => {
		expect(new SafeJwtDTO(token)).toBeDefined();
	});

	it('throws if token is undefined', () => {
		expect(() => new SafeJwtDTO(undefined)).toThrow('Token must be defined');
	});

	it(('throws error if token is shorter than 20 characters'), () => {
		expect(() => new SafeJwtDTO('a'.repeat(19))).toThrow('Token must be between 20 and 1024 characters');
	});

	it(('throws error if token is longer than 1024 characters'), () => {
		expect(() => new SafeJwtDTO('a'.repeat(1025))).toThrow('Token must be between 20 and 1024 characters');
	});
	
	it(('throws error if token is not formatted correctly'), () => {
		expect(() => new SafeJwtDTO('not-valid'.repeat(10))).toThrow('Token must include 3 base64-encoded parts separated by periods');
	});

	it(('throws error if token fails to decode'), () => {
		expect(() => new SafeJwtDTO('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload.invalid_signature')).toThrow('Token must be a valid JWT');
	});
});