import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public Decorator', () => {
	it('sets the IS_PUBLIC_KEY metadata to true', () => {
		// Create a mock target and property
		const mockTarget = {};
		const mockPropertyKey = 'testMethod';
		const mockDescriptor: TypedPropertyDescriptor<unknown> = { value: jest.fn() };

		// Apply the Public decorator
		const decorator = Public();
		decorator(mockTarget, mockPropertyKey, mockDescriptor);

		// Use Reflect API to check if the metadata was set
		const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, mockDescriptor.value as any);

		// Assert that the metadata is set to true
		expect(metadata).toBe(true);
	});
});