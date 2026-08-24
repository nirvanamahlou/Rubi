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
  it('contains domain and application ports without persistence or active controllers', () => {
    const source = productionSources();
    expect(source).toContain('FinanceCommandPort');
    expect(source).toContain('FinanceIntegrationPort');
    expect(source).toContain('JournalEntry');
    expect(source).not.toMatch(
      /@rubi\/database|PrismaClient|@nestjs|Controller|\.\.\/customers|\.\.\/master-data|\.\.\/iam/,
    );
  });

  it('does not expose a controller, module, repository or persistence file', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'finance'));
    expect(
      files.some((file) =>
        /controller|module|repository|persistence/i.test(file),
      ),
    ).toBe(false);
  });

  it('never models monetary values as number fields', () => {
    const source = productionSources();
    expect(source).not.toMatch(/amount\??:\s*number/);
    expect(source).not.toMatch(/rate\??:\s*number/);
  });
});
