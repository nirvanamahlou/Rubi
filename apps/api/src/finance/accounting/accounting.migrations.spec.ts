import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('accounting migration ownership', () => {
  it('only adds accounting structures without changing unrelated existing tables', () => {
    for (const migration of [
      '20261007150000_finance_accounting',
      '20261007151000_finance_accounting_fx',
      '20261007152000_finance_accounting_integrity',
      '20261007153000_finance_accounting_audit',
    ]) {
      const sql = readFileSync(
        resolve(
          process.cwd(),
          '../../packages/database/prisma/migrations',
          migration,
          'migration.sql',
        ),
        'utf8',
      );
      expect(sql).not.toMatch(/^\s*DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/im);
      expect(sql).not.toMatch(/\bRENAME\s+(TO|COLUMN|CONSTRAINT)\b/i);
      for (const match of sql.matchAll(
        /\b(?:ALTER|CREATE)\s+TABLE\s+"?([a-z_]+)"?/gi,
      ))
        expect(match[1]).toMatch(/^accounting_/);
      expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i);
    }
  });
});
