import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
afterEach(() => vi.unstubAllEnvs());
describe('accounting disposable database guard', () => {
  it('never falls back to the ordinary application database without the explicit CI flag', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('NORA_RUN_LEDGER_PARITY_POSTGRES_TESTS', '');
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://user:synthetic@example.test/production',
    );
    vi.stubEnv('ACCOUNTING_TEST_DATABASE_URL', undefined);
    expect(accountingTestUrl('ACCOUNTING_TEST_DATABASE_URL')).toBeUndefined();
  });
  it('allows the named local fixture and rejects other names or non-loopback hosts', () => {
    expect(() =>
      assertAccountingTestDatabase(
        'postgresql://test:synthetic@127.0.0.1:55442/rubi_completion_test',
        '55442',
        'rubi_completion_test',
      ),
    ).not.toThrow();
    for (const url of [
      'postgresql://test:synthetic@127.0.0.1:55442/rubi_restore',
      'postgresql://test:synthetic@example.test:55442/rubi_completion_test',
      'postgresql://test:synthetic@127.0.0.1:55442/rubi_completion_test?host=example.test',
    ])
      expect(() =>
        assertAccountingTestDatabase(url, '55442', 'rubi_completion_test'),
      ).toThrow();
  });
  it('requires CI mode, opt-in, exact disposable database and CI principal', () => {
    const url =
      'postgresql://nora_ci:synthetic@127.0.0.1:5432/nora_ci?schema=public';
    vi.stubEnv('CI', '');
    vi.stubEnv('NORA_RUN_LEDGER_PARITY_POSTGRES_TESTS', '1');
    expect(() =>
      assertAccountingTestDatabase(url, '55442', 'rubi_completion_test'),
    ).toThrow();
    vi.stubEnv('CI', 'true');
    expect(() =>
      assertAccountingTestDatabase(url, '55442', 'rubi_completion_test'),
    ).not.toThrow();
    expect(() =>
      assertAccountingTestDatabase(
        url.replace('nora_ci:', 'admin:'),
        '55442',
        'rubi_completion_test',
      ),
    ).toThrow();
  });
});
