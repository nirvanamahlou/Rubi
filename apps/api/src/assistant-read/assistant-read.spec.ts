import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AssistantReadModule } from './assistant-read.module';
import { readOnlyDatabaseUrl } from './main';
import { AssistantReadAccessController } from './assistant-read-access.controller';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MANUAL_ACCESS_VERSION, screenPermission } from '@nora/contracts';
describe('isolated ERP report runtime boundary', () => {
  it('checks manual source permission without restoring shared grants or accepting arbitrary sources', () => {
    const controller = new AssistantReadAccessController();
    const request = {
      actor: {
        userId: 'synthetic',
        permissions: [MANUAL_ACCESS_VERSION],
        branchIds: [],
      },
    } as unknown as AuthenticatedRequest;
    expect(() => controller.access(request, 'calendar')).toThrow();
    expect(() => controller.access(request, 'finance.write')).toThrow(
      'ASSISTANT_FIXED_SCOPE',
    );
    request.actor.permissions.push(screenPermission('workbench.tab.calendar'));
    expect(controller.access(request, 'calendar')).toBe(request.actor);
    request.actor.permissions = [];
    expect(controller.access(request)).toBe(request.actor);
  });
  it('forces PostgreSQL read-only and bounded statements before constructing any pool', () => {
    const url = new URL(
      readOnlyDatabaseUrl(
        'postgresql://synthetic:synthetic@127.0.0.1:5432/test?options=-c%20default_transaction_read_only%3Doff',
      ),
    );
    expect(url.searchParams.get('options')).toBe(
      '-c default_transaction_read_only=on -c statement_timeout=2500',
    );
    expect(() => readOnlyDatabaseUrl(undefined)).toThrow(
      'READ_DATABASE_CONFIGURATION_REQUIRED',
    );
    expect(() => readOnlyDatabaseUrl('https://example.invalid')).toThrow(
      'READ_DATABASE_CONFIGURATION_INVALID',
    );
  });
  it('registers report controllers and native auth only; no business modules or dispatchers', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AssistantReadModule,
    ) as Array<{ name: string }>;
    expect(controllers.map((controller) => controller.name)).toEqual([
      'AssistantReadAccessController',
      'AssistantReadHealthController',
      'SalesAssistantController',
      'CustomerAffairsAssistantController',
    ]);
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AssistantReadModule,
    ) as Array<{ name: string }>;
    expect(providers.map((provider) => provider.name)).not.toContain(
      'SalesReservationDispatcher',
    );
    expect(providers.map((provider) => provider.name)).not.toContain(
      'FinanceFollowupService',
    );
  });
});
