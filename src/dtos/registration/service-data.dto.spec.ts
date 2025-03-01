import { ServiceDataDTO, ServiceDataDTOProps } from './service-data.dto';

describe('ServiceDataDTO', () => {
	let validProps: ServiceDataDTOProps;

	beforeEach(() => {
		validProps = {
		location: 'https://localhost:3000',
		serviceId: '123e4567-e89b-12d3-a456-426614174000',
		serviceName: 'fitnessapp-conditioning-service',
		};
	});

	it('creates an instance with valid properties', () => {
		const dto = new ServiceDataDTO(validProps);
		expect(dto.location).toBe(validProps.location);
		expect(dto.serviceId).toBe(validProps.serviceId);
		expect(dto.serviceName).toBe(validProps.serviceName);
	});

	describe('sanitization', () => {
		describe('location', () => {
			it('assigns valid location', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(dto.location).toBe('https://localhost:3000');
			});

			it('assigns valid location with port', () => {
				const dto = new ServiceDataDTO(validProps);
				dto.location = 'https://localhost:3010/auth/api/v1';
				expect(dto.location).toBe('https://localhost:3010/auth/api/v1');
			});

			it('trims leading and trailing whitespace', () => {
				const dto = new ServiceDataDTO(validProps);
				dto.location = '  https://localhost:3000  ';
				expect(dto.location).toBe('https://localhost:3000');
			});

			it('converts to lowercase', () => {
				const dto = new ServiceDataDTO(validProps);
				dto.location = 'HTTPs://LOCALHOST:3000';
				expect(dto.location).toBe('https://localhost:3000');
			});

			it('throws error if location is less than 3 characters', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.location = 'ab').toThrow();
			});

			it('throws error if location is longer than 256 characters', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.location = 'a'.repeat(257)).toThrow();
			});

			it('throws error if location is not a valid URL', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.location = 'https:/localhost').toThrow();
			});

			it('throws error if location is not served over https', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.location = 'http://localhost:3000').toThrow();
			});
		});

		describe('serviceId', () => {
			it('assigns valid serviceId', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(dto.serviceId).toBe('123e4567-e89b-12d3-a456-426614174000');
			});

			it('trims leading and trailing whitespace', () => {
				const dto = new ServiceDataDTO(validProps);
				dto.serviceId = '123e4567-e89b-12d3-a456-426614174000';
				expect(dto.serviceId).toBe('123e4567-e89b-12d3-a456-426614174000');
			});

			it('throws error if serviceId is less than 3 characters', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.serviceId = '12').toThrow();
			});

			it('throws error if serviceId is more than 36 characters', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.serviceId = 'a'.repeat(37)).toThrow();
			});
		});

		describe('serviceName', () => {
			it('assigns valid serviceName', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(dto.serviceName).toBe('fitnessapp-conditioning-service');
			});

			it('trims leading and trailing whitespace', () => {
				const dto = new ServiceDataDTO(validProps);
				dto.serviceName = 'fitnessapp-conditioning-service';
				expect(dto.serviceName).toBe('fitnessapp-conditioning-service');
			});

			it('converts to lowercase', () => {
				const dto = new ServiceDataDTO(validProps);
				dto.serviceName = 'FITNESSAPP-CONDITIONING-SERVICE';
				expect(dto.serviceName).toBe('fitnessapp-conditioning-service');
			});

			it('throws error if serviceName is less than 3 characters', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.serviceName = 'fi').toThrowError();
			});

			it('throws error if serviceName is more than 256 characters', () => {
				const dto = new ServiceDataDTO(validProps);
				expect(() => dto.serviceName = 'a'.repeat(257)).toThrow();
			});
		});
	});

	describe('serialization', () => {
		it('converts to object literal', () => {
			const dto = new ServiceDataDTO(validProps);
			const obj = dto.toJSON();
			expect(obj).toEqual(validProps);
		});
	});
});