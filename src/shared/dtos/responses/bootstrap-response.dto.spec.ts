import { BootstrapResponseDTO, BootstrapResponseDTOProps } from './bootstrap-response.dto';
import { ServiceDataDTO } from './service-data.dto';

describe('BootstrapResponseDTO', () => {
	let dto: BootstrapResponseDTO;
	let serviceDataDTO: ServiceDataDTO;
	let validProps: BootstrapResponseDTOProps;

	beforeEach(() => {
		validProps = {
			authServiceData: {
				location: 'https://localhost:3000',
				serviceId: '123e4567-e89b-12d3-a456-426614174000',
				serviceName: 'fitnessapp-auth-service',
			},
			verificationToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
		};

		dto = new BootstrapResponseDTO(validProps);
		serviceDataDTO = new ServiceDataDTO(validProps.authServiceData!);
	});

	it('creates an instance with valid properties', () => {
		expect(dto.authServiceData).toEqual(serviceDataDTO);
		expect(dto.verificationToken).toBe(validProps.verificationToken);
	});

	describe('sanitization', () => {
		describe('authServiceData', () => {
			it('assigns valid authServiceData', () => {
				expect(dto.authServiceData).toEqual(serviceDataDTO);
			});

			it('throws error if authServiceData is undefined', () => {
				const invalidProps = {...validProps, authServiceData: undefined as any};
				expect(() => new BootstrapResponseDTO(invalidProps)).toThrow();
			});

			it('throws error if authServiceData is invalid', () => {
				const invalidProps = {...validProps, authServiceData: {location: 'invalid.location', serviceId: 'invalid.serviceId', serviceName: 'invalid.serviceName'}};
				expect(() => new BootstrapResponseDTO(invalidProps)).toThrow();
			});
		});

		describe('verificationToken', () => {
			it('assigns valid verificationToken', () => {
				expect(dto.verificationToken).toBe(validProps.verificationToken);
			});

			it('throws error if verificationToken is not provided', async () => {
				const invalidProps = {...validProps, verificationToken: undefined as any};
				expect(() => new BootstrapResponseDTO(invalidProps)).toThrow();
			});

			it('throws error if verificationToken is less than 20 characters', async () => {
				validProps.verificationToken = 'short.token';
				const invalidProps = {...validProps, verificationToken: 'short.token'};
				expect(() => new BootstrapResponseDTO(invalidProps)).toThrow();
			});

			it('throws error if verificationToken is more than 1024 characters', async () => {
				const invalidProps = {...validProps, verificationToken: 'a'.repeat(1025)};
				expect(() => new BootstrapResponseDTO(invalidProps)).toThrow();
			});

			it('throws error if verificationToken does not match JWT pattern', async () => {
				const invalidProps = {...validProps, verificationToken: 'invalid.token-format'};
				expect(() => new BootstrapResponseDTO(invalidProps)).toThrow();
			});
		});
	});

	describe('serialization', () => {
		it('serializes to JSON', () => {
			const json = dto.toJSON();
			expect(json).toEqual(validProps);
		});
	});
});