import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAccessControl, type IamPermissionCode } from '@nora/contracts';

import { ACCESS_CONTROLS_KEY, PERMISSIONS_KEY } from './iam.constants';
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
    const requiredControls =
      this.reflector.getAllAndOverride<string[]>(ACCESS_CONTROLS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const deniedControl = requiredControls.find(
      (controlId) => !hasAccessControl(request.actor.permissions, controlId),
    );
    if (deniedControl)
      throw new ForbiddenException({
        error: 'ACCESS_CONTROL_RESTRICTED',
        controlId: deniedControl,
      });
    return true;
  }
}
