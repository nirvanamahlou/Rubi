import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { IamService } from './iam.service';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  it('delegates deny-by-default permission checking to IAM service', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['iam.users.manage']),
    } as unknown as Reflector;
    const iam = { assertPermissions: vi.fn() } as unknown as IamService;
    const guard = new PermissionGuard(reflector, iam);
    const actor = {
      userId: 'u1',
      sessionId: 's1',
      permissions: [],
      branchIds: [],
    };
    const context = {
      getHandler: () => vi.fn(),
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => ({ actor }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'iam.users.manage',
    ]);
  });
});
