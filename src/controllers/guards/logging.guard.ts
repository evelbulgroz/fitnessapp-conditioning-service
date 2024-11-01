import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { Logger } from '@evelbulgroz/ddd-base';

@Injectable()
export class LoggingGuard implements CanActivate {
  constructor(private readonly logger: Logger) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    this.logger.log(`User ${user?.username || 'unknown'} accessed ${method} ${url}`);
    return true;
  }
}