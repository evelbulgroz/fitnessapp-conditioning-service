import { TestingModule } from '@nestjs/testing';

import { BcryptCryptoService } from './bcrypt-crypto.service';
import { createTestingModule } from '../../../../test/test-utils';

describe('BcryptCryptoService', () => {
	let cryptoService: BcryptCryptoService;	
	beforeEach(async () => {
		const module: TestingModule = await (await createTestingModule({
			imports: [
				//ConfigModule is imported automatically by createTestingModule
			],
			providers: [
				BcryptCryptoService,
			],
		}))
		.compile();

		cryptoService = module.get<BcryptCryptoService>(BcryptCryptoService);
	});

	it('can be created', () => {
		expect(cryptoService).toBeDefined();
	});

	describe('hash', () => {
		it('should generate a hash from a property', async () => {
			const property = 'mySecret';
			const hash = await cryptoService.hash(property);

			expect(hash).toBeDefined();
			expect(hash).not.toBe(property);
		});
	});

	describe('compare', () => {
		it('should return true for a matching property and hash', async () => {
			const property = 'mySecret';
			const hash = await cryptoService.hash(property);
			const isMatch = await cryptoService.compare(property, hash);

			expect(isMatch).toBe(true);
		});

		it('should return false for a non-matching property and hash', async () => {
			const property = 'mySecret';
			const hash = await cryptoService.hash(property);
			const isMatch = await cryptoService.compare('wrongSecret', hash);

			expect(isMatch).toBe(false);
		});
	});
});