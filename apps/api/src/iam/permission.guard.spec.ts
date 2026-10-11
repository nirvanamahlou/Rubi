import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { IamService } from './iam.service';
import { ACCESS_CONTROLS_KEY, PERMISSIONS_KEY } from './iam.constants';
import { PermissionGuard } from './permission.guard';
import { Reflector as MetadataReflector } from '@nestjs/core';
import { B2bController } from '../b2b/b2b.controller';
import { CustomerAffairsController } from '../customer-affairs/customer-affairs.controller';

describe('PermissionGuard', () => {
  it.each([
    [
      B2bController.prototype.createSignatory,
      B2bController,
      'organizations.profile.tab.signatories',
    ],
    [
      B2bController.prototype.creditPolicy,
      B2bController,
      'organizations.profile.tab.credit',
    ],
    [
      B2bController.prototype.agreedRate,
      B2bController,
      'organizations.profile.tab.rates',
    ],
    [
      CustomerAffairsController.prototype.correctiveAction,
      CustomerAffairsController,
      'customer-affairs.view.satisfaction',
    ],
  ] as const)(
    'enforces actual controller metadata for %s',
    (handler, controller, controlId) => {
      const iam = { assertPermissions: vi.fn() } as unknown as IamService;
      const guard = new PermissionGuard(new MetadataReflector(), iam);
      const contextFor = (permissions: readonly string[]) =>
        ({
          getHandler: () => handler,
          getClass: () => controller,
          switchToHttp: () => ({
            getRequest: () => ({
              actor: {
                userId: 'test',
                sessionId: 'test',
                branchIds: [],
                permissions,
              },
            }),
          }),
        }) as unknown as ExecutionContext;
      expect(guard.canActivate(contextFor([]))).toBe(true);
      expect(() =>
        guard.canActivate(contextFor([`ui.deny.${controlId}`])),
      ).toThrow();
      expect(
        guard.canActivate(
          contextFor([`ui.deny.${controlId}`, 'ui.administrator']),
        ),
      ).toBe(true);
    },
  );
  it('delegates deny-by-default permission checking to IAM service', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === PERMISSIONS_KEY ? ['iam.users.manage'] : [],
      ),
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

  it('accepts a published domain permission through the shared actor contract', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === PERMISSIONS_KEY ? ['master_data.read'] : [],
      ),
    } as unknown as Reflector;
    const iam = { assertPermissions: vi.fn() } as unknown as IamService;
    const guard = new PermissionGuard(reflector, iam);
    const actor = {
      userId: 'u1',
      sessionId: 's1',
      permissions: ['master_data.read'],
      branchIds: ['hq'],
    };
    const context = {
      getHandler: () => vi.fn(),
      getClass: () => class MasterDataController {},
      switchToHttp: () => ({ getRequest: () => ({ actor }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'master_data.read',
    ]);
  });

  it('rejects an explicitly denied API access control while preserving legacy absence', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === ACCESS_CONTROLS_KEY ? ['reports.view.downloads'] : [],
      ),
    } as unknown as Reflector;
    const iam = { assertPermissions: vi.fn() } as unknown as IamService;
    const guard = new PermissionGuard(reflector, iam);
    const contextFor = (permissions: readonly string[]) =>
      ({
        getHandler: () => vi.fn(),
        getClass: () => class ReportingController {},
        switchToHttp: () => ({
          getRequest: () => ({
            actor: {
              userId: 'u1',
              sessionId: 's1',
              permissions,
              branchIds: [],
            },
          }),
        }),
      }) as unknown as ExecutionContext;

    expect(guard.canActivate(contextFor([]))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(['ui.deny.reports.view.downloads'])),
    ).toThrowError('Forbidden Exception');
  });
});
