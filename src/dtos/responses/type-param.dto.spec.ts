import TypeParamDTO from './type-param.dto';

describe('TypeParamDTO', () => {
    it('creates an instance with a valid value', () => {
        const typeParam = new TypeParamDTO('ConditioningLog');
        expect(typeParam.value).toBe('ConditioningLog');
    });

    it('throws error if the value is not a string', () => {
        expect(() => new TypeParamDTO(123 as any)).toThrow('type must be a string');
    });

    it('throws error if the value is empty', () => {
        expect(() => new TypeParamDTO('')).toThrow('type must not be empty');
    });

    it('throws error if the value exceeds 40 characters', () => {
        const longString = 'a'.repeat(41);
        expect(() => new TypeParamDTO(longString)).toThrow('type must have maximum 40 characters');
    });

    it('throws error if the value does not match the regex', () => {
        expect(() => new TypeParamDTO('InvalidType')).toThrow('type must be one of (case-sensitive): ConditioningLog');
    });

    it('should allow setting a valid value', () => {
        const typeParam = new TypeParamDTO('ConditioningLog');
        typeParam.value = 'ConditioningLog';
        expect(typeParam.value).toBe('ConditioningLog');
    });

    it('throws error when setting an invalid value', () => {
        const typeParam = new TypeParamDTO('ConditioningLog');
        expect(() => { typeParam.value = 'InvalidType'; }).toThrow('type must be one of (case-sensitive): ConditioningLog');
    });
});