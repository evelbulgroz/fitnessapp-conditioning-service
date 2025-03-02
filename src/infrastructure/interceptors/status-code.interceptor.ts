import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Utility interceptor to set the default status code for all responses in a controller */
@Injectable()
export class DefaultStatusCodeInterceptor implements NestInterceptor {
constructor(private readonly statusCode: number) {}
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const response = context.switchToHttp().getResponse();
		response.status(this.statusCode);
		return next.handle().pipe(
		map(data => data),
		);
	}
}