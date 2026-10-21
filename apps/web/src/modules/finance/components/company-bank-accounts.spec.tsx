import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompanyBankAccounts } from './company-bank-accounts';
describe('company accounts in bank profile', () => {
  it('renders an accessible isolated loading panel without leaking numbers', () => {
    const html = renderToStaticMarkup(<CompanyBankAccounts bankId="bank-id" />);
    expect(html).toContain('حساب‌های شرکت در این بانک');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('4111111111111111');
  });
  it('uses the owner client, a capture/retry guard, explicit field labels, and centered icon actions', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/finance/components/company-bank-accounts.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('bankAccountsApi.details(bankId, row.id)');
    expect(source).toContain('expectedVersion: captured.record!.version');
    expect(source).toContain('requestId: captured.requestId');
    expect(source).toContain('busy.current');
    expect(source).toContain('generation.current !== current');
    for (const label of ['شماره حساب', 'شماره کارت', 'شماره شبا'])
      expect(source).toContain(label);
    expect(source).toContain('flex justify-center gap-2');
    expect(source).toContain('role="alert"');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('Number(editor.values');
    const profile = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/master-data/components/master-data-bank-profile.tsx',
      ),
      'utf8',
    );
    expect(profile).toContain('<CompanyBankAccounts');
  });
});
