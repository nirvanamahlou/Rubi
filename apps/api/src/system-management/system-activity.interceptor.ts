import {
  Inject,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { concatMap } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../iam/iam.types';

@Injectable()
export class SystemActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SystemActivityInterceptor.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const actor = request.actor;
    if (
      !actor ||
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ) {
      return next.handle();
    }

    const controller = Reflect.getMetadata(PATH_METADATA, context.getClass());
    const handler = Reflect.getMetadata(PATH_METADATA, context.getHandler());
    if (typeof controller !== 'string' || typeof handler !== 'string')
      return next.handle();
    const path = [controller, handler]
      .map((part) => part.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
    const section = path.split('/')[0] ?? 'system-management';

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        if (http.getResponse<{ statusCode: number }>().statusCode >= 400)
          return result;
        try {
          await this.database.client.systemAuditEvent.create({
            data: {
              actorUserId: actor.userId,
              action: `${request.method} /${path}`.slice(0, 120),
              entityType: 'UserActivity',
              entityId: section.slice(0, 160),
              outcome: 'SUCCESS',
              reason: '',
            },
          });
        } catch {
          this.logger.error('Could not record successful user activity');
        }
        return result;
      }),
    );
  }
}
