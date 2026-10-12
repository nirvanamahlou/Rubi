import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AssistantReadModule } from './assistant-read.module';
import { readOnlyDatabaseUrl } from './main';
describe('isolated ERP report runtime boundary', () => {
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
