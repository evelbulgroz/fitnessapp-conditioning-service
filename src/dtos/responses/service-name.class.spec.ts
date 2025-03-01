import {ServiceName} from './service-name.class';

describe('SafeServiceName', () => {
	it('can be created', () => {
		expect(new ServiceName('test service')).toBeTruthy();
	});

	describe('sanitize', () => {
		let data: ServiceName;

		beforeEach(() => {
			data = new ServiceName(' test Service ');
		});

		it('trims the service name', () => {
			expect(data.value).toBe('test service');
		});

		it('converts the service name to lowercase', () => {
			expect(data.value).toBe('test service');
		});
	});
	
	describe('validate', () => {
		it('succeeds if service name is valid', () => {
			expect(() => new ServiceName('test service')).not.toThrow();
		});

		it('fails if service name is not defined', () => {
			expect(() => new ServiceName(undefined as any)).toThrow();
		});
		
		it('fails if service name is not a string', () => {
			expect(() => new ServiceName(123 as any)).toThrow();
		});

		it('fails if service name is shorter than 3 characters', () => {
			expect(() => new ServiceName('aa')).toThrow();
		});

		it('fails if service name is longer than 256 characters', () => {
			expect(() => new ServiceName('a'.repeat(1025))).toThrow();
		});
		
	});	
});