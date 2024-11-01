import TypeParam from './type-param.model';

describe('TypeParam', () => {
    it('should create an instance with a valid value', () => {
        const typeParam = new TypeParam('ConditioningLog');
        expect(typeParam.value).toBe('ConditioningLog');
    });

    it('should throw an error if the value is not a string', () => {
        expect(() => new TypeParam(123 as any)).toThrow('type must be a string');
    });

    it('should throw an error if the value is empty', () => {
        expect(() => new TypeParam('')).toThrow('type must not be empty');
    });

    it('should throw an error if the value exceeds 40 characters', () => {
        const longString = 'a'.repeat(41);
        expect(() => new TypeParam(longString)).toThrow('type must have maximum 40 characters');
    });

    it('should throw an error if the value does not match the regex', () => {
        expect(() => new TypeParam('InvalidType')).toThrow('type must be one of (case-sensitive): ConditioningLog');
    });

    it('should allow setting a valid value', () => {
        const typeParam = new TypeParam('ConditioningLog');
        typeParam.value = 'ConditioningLog';
        expect(typeParam.value).toBe('ConditioningLog');
    });

    it('should throw an error when setting an invalid value', () => {
        const typeParam = new TypeParam('ConditioningLog');
        expect(() => { typeParam.value = 'InvalidType'; }).toThrow('type must be one of (case-sensitive): ConditioningLog');
    });
});