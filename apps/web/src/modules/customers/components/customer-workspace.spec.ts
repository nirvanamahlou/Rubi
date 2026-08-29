import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CustomersApiError } from '../api/client';
import { customerListFailureState } from './customer-workspace-state';

const source = readFileSync(
  new URL('./customer-workspace.tsx', import.meta.url),
  'utf8',
);

describe('Customer Operations workspace boundaries', () => {
  it.each([
    [new CustomersApiError('unauthorized', 401), 'unauthorized'],
    [new CustomersApiError('forbidden', 403), 'forbidden'],
    [new CustomersApiError('conflict', 409), 'error'],
    [new CustomersApiError('server', 500), 'error'],
    [new TypeError('network failed'), 'error'],
  ] as const)(
    'classifies list failures without conflating auth states',
    (error, state) => {
      expect(customerListFailureState(error)).toBe(state);
    },
  );

  it('offers an explicit login path only for the unauthorized state', () => {
    expect(source).toContain('customerListFailureState(error)');
    expect(source).toContain('href="/login?next=%2Fcustomers"');
    expect(source).toContain('نیاز به ورود دوباره');
    expect(source).toContain('دسترسی مشتریان وجود ندارد');
  });

  it('uses public master-data APIs and keeps Legal Entity out of customer scope', () => {
    expect(source).toContain(
      "import { masterDataApi } from '@/modules/master-data/api/client'",
    );
    expect(source).toContain("listMasterData('organizations')");
    expect(source).toContain("listMasterData('acquaintance-methods')");
    expect(source).toContain("listMasterData('cities')");
    expect(source).not.toMatch(
      /legalEntityId|issuerContext|selectedLegalEntity/,
    );
  });

  it('requires an allowlisted reason before sensitive reveal', () => {
    expect(source).toContain("'customer-verification'");
    expect(source).toContain("'support-request'");
    expect(source).toContain("'data-correction'");
    expect(source).toContain(
      'customersApi.detail(customer.id, sensitiveReason)',
    );
    expect(source).toContain('disabled={busy || !sensitiveReason}');
  });

  it('does not fake blocked phase B capabilities or enable merge execution', () => {
    expect(source).toContain('BLOCKED_FOR_CUSTOMER_002B');
    expect(source).toContain('داده ساختگی نمایش داده نمی‌شود');
    expect(source).toContain('اجرای Merge');
    expect(source).toMatch(/<Button\s+disabled\s+size="sm"/);
  });

  it('exposes the complete Customer 360 navigation', () => {
    for (const tab of [
      'overview',
      'contacts',
      'addresses',
      'consents',
      'companions',
      'status-history',
      'duplicates',
      'activity',
      'audit',
    ]) {
      expect(source).toContain('value="' + tab + '"');
    }
  });
});
