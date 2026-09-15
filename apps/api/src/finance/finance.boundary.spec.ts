import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function productionSources() {
  const root = join(process.cwd(), 'src', 'finance');
  return readdirSync(root)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
}

describe('finance foundation boundary', () => {
  it('contains domain/application ports and scoped finance inbox commands', () => {
    const source = productionSources();
    expect(source).toContain('FinanceCommandPort');
    expect(source).toContain('FinanceIntegrationPort');
    expect(source).toContain('JournalEntry');
    expect(source).not.toMatch(
      /@nora\/database|PrismaClient|\.\.\/customers|\.\.\/master-data/,
    );
    expect(source).toContain("@Get('inbox')");
    expect(source).toContain("@Post('settlement-accounts')");
    expect(source).toContain("@Post('inbox/sales/:paymentId/decision')");
    expect(source).toContain(
      "@Post('inbox/reservations/:intakeId/purchases/:purchaseId/payments')",
    );
    expect(source).toContain("@RequirePermissions('finance.receipt.approve')");
    expect(source).toContain("@RequirePermissions('finance.payment.create')");
    expect(source).not.toMatch(/@Patch|@Put|@Delete/);
  });

  it('does not add a finance repository or persistence adapter', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'finance'));
    expect(files.some((file) => /repository|persistence/i.test(file))).toBe(
      false,
    );
  });

  it('never models monetary values as number fields', () => {
    const source = productionSources();
    expect(source).not.toMatch(/amount\??:\s*number/);
    expect(source).not.toMatch(/rate\??:\s*number/);
  });
});
