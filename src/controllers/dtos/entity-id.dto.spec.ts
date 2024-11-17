import { EntityId } from '@evelbulgroz/ddd-base';

import { EntityIdDTO } from './entity-id.dto';

describe('EntityIdDTO', () => {
	it('should create an instance with a valid ID that is a string', () => {
		const validId: EntityId = '507f1f77bcf86cd799439011';
		const dto = new EntityIdDTO(validId);
		expect(dto).toBeInstanceOf(EntityIdDTO);
		expect(dto.value).toBe(validId);
		expect(typeof dto.value).toBe('string');
	});

	it('should create an instance with a valid ID that is a number', () => {
		const validId: EntityId = 507;
		const dto = new EntityIdDTO(validId);
		expect(dto).toBeInstanceOf(EntityIdDTO);
		expect(dto.value).toBe(validId);
		expect(typeof dto.value).toBe('number');
	});

	it('throws an error if value is neither a string nor a number', () => {
		const invalidId: any = { invalid: 'id' };
		expect(() => new EntityIdDTO(invalidId)).toThrowError();
	});

	it('throws an error if value is undefined', () => {
		const invalidId: any = undefined;
		expect(() => new EntityIdDTO(invalidId)).toThrowError();
	});

	it('throws an error if value is null', () => {
		const invalidId: any = null;
		expect(() => new EntityIdDTO(invalidId)).toThrowError();
	});

	it('throws an error if value is an empty string', () => {
		const invalidId: any = '';
		expect(() => new EntityIdDTO(invalidId)).toThrowError();
	});
});