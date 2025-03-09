import { Test, TestingModule } from '@nestjs/testing';

import JwtSecretService from './jwt-secret.service';

describe('JwtSecretService', () => {
	let secret: string;
	let secretService: any;
	beforeEach(async () => {
		secret = 'test-secret';
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: JwtSecretService,
					useFactory: () => {
					  return new JwtSecretService(secret);
					},
				},
			],
		}).compile();

		secretService = module.get<JwtSecretService>(JwtSecretService);
	});

	it('can be created', () => {
		expect(secretService).toBeDefined();
	});

	it('can get and set the secret', () => {
		// arrange
		expect(secretService.getSecret()).toBe(secret); // default value
		const newSecret = 'new-secret';

		// act
		secretService.setSecret(newSecret);

		// assert
		expect(secretService.getSecret()).toBe(newSecret);
	});
});