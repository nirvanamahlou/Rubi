import type { ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { SystemActivityInterceptor } from './system-activity.interceptor';

function fixture(method = 'PATCH', authenticated = true) {
  const create = vi.fn().mockResolvedValue({});
  const interceptor = new SystemActivityInterceptor({
    client: { systemAuditEvent: { create } },
  } as unknown as DatabaseService);
  class Controller {}
  function handler() {}
  Reflect.defineMetadata(PATH_METADATA, 'hr', Controller);
  Reflect.defineMetadata(PATH_METADATA, 'employees/:id', handler);
  const context = {
    getType: () => 'http',
    getClass: () => Controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        actor: authenticated ? { userId: 'user-id' } : undefined,
        body: { password: 'private-input' },
        originalUrl: '/hr/employees/private-id',
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
  return { create, interceptor, context };
}

describe('system activity capture', () => {
  it('records the successful action using a route template and no request data', async () => {
    const { create, interceptor, context } = fixture();
    const response = { saved: true };
    await expect(
      lastValueFrom(
        interceptor.intercept(context, { handle: () => of(response) }),
      ),
    ).resolves.toBe(response);
    expect(create).toHaveBeenCalledExactlyOnceWith({
      data: {
        actorUserId: 'user-id',
        action: 'PATCH /hr/employees/:id',
        entityType: 'UserActivity',
        entityId: 'hr',
        outcome: 'SUCCESS',
        reason: '',
      },
    });
  });

  it('does not record unsuccessful actions, reads, or anonymous requests', async () => {
    const failed = fixture();
    const error = new Error('write failed');
    await expect(
      lastValueFrom(
        failed.interceptor.intercept(failed.context, {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);
    expect(failed.create).not.toHaveBeenCalled();
    for (const input of [fixture('GET'), fixture('POST', false)]) {
      await lastValueFrom(
        input.interceptor.intercept(input.context, { handle: () => of({}) }),
      );
      expect(input.create).not.toHaveBeenCalled();
    }
  });
});
