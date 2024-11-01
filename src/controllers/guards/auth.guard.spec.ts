import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

class TestAuthGuard extends AuthGuard {
	public async canActivate(context: ExecutionContext): Promise<boolean> {
		return true;
	}
}

describe('AuthGuard', () => {
	let context: ExecutionContext;
	let guard: TestAuthGuard;
	beforeEach(() => {
		context = createMockExecutionContext('test-token');
		guard = new TestAuthGuard();
	});

	describe('handleRequest', () => {
		it('returns user if no error and user is provided', async () => {
			const user = { id: 1, name: 'Test User' } as any;
			const result = await guard.handleRequest(null, user, null, context);
			expect(result).toBe(user);
		});

		it('throws UnauthorizedException if no user is provided', async () => {
			await expect(guard.handleRequest(null, null, null, context)).rejects.toThrow(UnauthorizedException);
		});

		it('throws the provided error if an error is provided', async () => {
			const error = new Error('Test Error');
			await expect(guard.handleRequest(error, null, null, context)).rejects.toThrow(error);
		});
	});

	function createMockExecutionContext(token: string | null): ExecutionContext {
		const request = {
			headers: {
				authorization: token ? `Bearer ${token}` : null,
			},
		} as unknown as Request;

		return {
			switchToHttp: () => ({
				getRequest: () => request,
			}),
		} as ExecutionContext;
	}
});