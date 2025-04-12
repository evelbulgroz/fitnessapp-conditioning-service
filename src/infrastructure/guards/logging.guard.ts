import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { Logger } from '@evelbulgroz/logger';

@Injectable()
export class LoggingGuard implements CanActivate {
  constructor(private readonly logger: Logger) {}

  canActivate(context: ExecutionContext): boolean {
	const controller = context.getClass();
	const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    this.logger.log(`User ${user?.userName || 'unknown'} (${user?.userId ? user?.userId : ''}) accessed ${method} ${url}`, controller.name);
    return true;
  }
}

export default LoggingGuard;