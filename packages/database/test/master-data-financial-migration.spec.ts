import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260829100000_master_data_financial_reference/migration.sql',
  ),
  'utf8',
);
const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('MASTER-003 financial reference migration', () => {
  it('is additive and leaves account/card data outside Master Data', () => {
    expect(sql).toContain('CREATE TABLE "master_bank_branches"');
    expect(sql).toContain('CREATE TABLE "master_payment_methods"');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(sql).not.toMatch(/(?:iban|cardNumber|cvv|accountNumber)/i);
  });

  it('enforces branch, SWIFT and display-order constraints', () => {
    expect(sql).toContain('master_bank_branch_code_format');
    expect(sql).toContain('master_bank_branches_bankId_code_key');
    expect(sql).toContain('master_bank_swift_format');
    expect(sql).toContain('master_payment_method_display_order_non_negative');
    expect(sql).toContain('ON DELETE RESTRICT');
  });

  it('keeps the seed idempotent and free of exchange-rate rows', () => {
    expect(seed).toContain('transaction.masterCurrency.upsert');
    expect(seed).not.toContain('masterDraftExchangeRate.create');
    expect(seed).not.toContain('masterDraftExchangeRate.upsert');
    expect(seed).not.toContain('transaction.masterBankBranch');
    expect(seed).not.toContain('transaction.masterPaymentMethod');
  });
});
