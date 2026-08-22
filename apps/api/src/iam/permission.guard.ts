import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IamPermissionCode } from '@rubi/contracts';

import { PERMISSIONS_KEY } from './iam.constants';
import { IamService } from './iam.service';
import type { AuthenticatedRequest } from './iam.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<IamPermissionCode[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    this.iam.assertPermissions(request.actor, required);
    return true;
  }
}
