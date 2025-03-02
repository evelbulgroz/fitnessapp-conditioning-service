import {ServiceNameDTO} from './service-name.dto';

describe('ServiceNameDTO', () => {
	it('can be created', () => {
		expect(new ServiceNameDTO('test service')).toBeTruthy();
	});

	describe('sanitize', () => {
		let data: ServiceNameDTO;

		beforeEach(() => {
			data = new ServiceNameDTO(' test Service ');
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
			expect(() => new ServiceNameDTO('test service')).not.toThrow();
		});

		it('fails if service name is not defined', () => {
			expect(() => new ServiceNameDTO(undefined as any)).toThrow();
		});
		
		it('fails if service name is not a string', () => {
			expect(() => new ServiceNameDTO(123 as any)).toThrow();
		});

		it('fails if service name is shorter than 3 characters', () => {
			expect(() => new ServiceNameDTO('aa')).toThrow();
		});

		it('fails if service name is longer than 256 characters', () => {
			expect(() => new ServiceNameDTO('a'.repeat(1025))).toThrow();
		});
		
	});	
});