import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 
 * Utility interceptor to set HTTP headers for all responses in a controller.
 * 
 * @remark Particularly useful for health check endpoints to prevent caching.
 * @remark Can be used at controller or method level.
 */
@Injectable()
export class HeadersInterceptor implements NestInterceptor {
	/**
	 * @param headers Key-value pairs of headers to apply to responses
	 */
	constructor(private readonly headers: Record<string, string>) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const response = context.switchToHttp().getResponse();
		
		// Apply all configured headers
		Object.entries(this.headers).forEach(([name, value]) => {
			response.setHeader(name, value);
		});
		
		return next.handle().pipe(
			map(data => data)
		);
	}
}

export default HeadersInterceptor;