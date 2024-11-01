import { EntityIdParam } from './entityid-param.model';
import { EntityId } from '@evelbulgroz/ddd-base';

describe('EntityIdParam', () => {
	it('should create an instance with a valid ID that is a string', () => {
		const validId: EntityId = '507f1f77bcf86cd799439011';
		const entityIdParam = new EntityIdParam(validId);
		expect(entityIdParam).toBeInstanceOf(EntityIdParam);
		expect(entityIdParam.value).toBe(validId);
		expect(typeof entityIdParam.value).toBe('string');
	});

	it('should create an instance with a valid ID that is a number', () => {
		const validId: EntityId = 507;
		const entityIdParam = new EntityIdParam(validId);
		expect(entityIdParam).toBeInstanceOf(EntityIdParam);
		expect(entityIdParam.value).toBe(validId);
		expect(typeof entityIdParam.value).toBe('number');
	});

	it('throws an error if value is neither a string nor a number', () => {
		const invalidId: any = { invalid: 'id' };
		expect(() => new EntityIdParam(invalidId)).toThrowError();
	});

	it('throws an error if value is undefined', () => {
		const invalidId: any = undefined;
		expect(() => new EntityIdParam(invalidId)).toThrowError();
	});

	it('throws an error if value is null', () => {
		const invalidId: any = null;
		expect(() => new EntityIdParam(invalidId)).toThrowError();
	});

	it('throws an error if value is an empty string', () => {
		const invalidId: any = '';
		expect(() => new EntityIdParam(invalidId)).toThrowError();
	});
});