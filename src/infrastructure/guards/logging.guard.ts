import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { StreamLoggableMixin } from '../../libraries/stream-loggable';

@Injectable()
export class LoggingGuard extends StreamLoggableMixin(class {}) implements CanActivate {
  constructor() {
	super();
  }

  canActivate(context: ExecutionContext): boolean {
	const controller = context.getClass();
	const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    this.logger.info(
		`User ${user?.userName || 'unknown'} (${user?.userId ?? 'unknown id'}) accessed ${method} ${url}`, controller.name);
    return true;
  }
}

export default LoggingGuard;