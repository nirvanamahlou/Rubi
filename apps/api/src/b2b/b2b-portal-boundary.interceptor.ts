import {
  ForbiddenException,
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { AuthController } from '../iam/auth.controller';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import { B2bPortalController } from './b2b-organization-user.controller';
@Injectable()
export class B2bPortalBoundaryInterceptor implements NestInterceptor {
  constructor(
    @Inject(B2bOrganizationUserRepository)
    private readonly repository: B2bOrganizationUserRepository,
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const actor = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().actor;
    if (actor && (await this.repository.byUser(actor.userId))) {
      // Includes inactive memberships. A later global IAM grant cannot bypass the portal boundary.
      if (
        context.getClass() !== B2bPortalController &&
        context.getClass() !== AuthController
      )
        throw new ForbiddenException(
          'این حساب فقط به پرونده آژانس خودش دسترسی دارد.',
        );
    }
    return next.handle();
  }
}
