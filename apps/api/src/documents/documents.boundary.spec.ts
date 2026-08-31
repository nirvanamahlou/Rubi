import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function productionSources(): string {
  const root = join(process.cwd(), 'src', 'documents');
  return readdirSync(root)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
}

describe('documents Phase A boundary', () => {
  it('contains domain, validation, application and adapter ports only', () => {
    const source = productionSources();
    expect(source).toContain('DocumentsApplicationPort');
    expect(source).toContain('ObjectStoragePort');
    expect(source).toContain('AntivirusScanPort');
    expect(source).toContain('DOCUMENTS_PHASE_A_NOTICE');
    expect(source).not.toMatch(
      /@rubi\/database|PrismaClient|@nestjs|packages\/database|\.\.\/iam|\.\.\/master-data|\.\.\/ticket-catalog/,
    );
  });

  it('does not expose an active controller, repository or fabricated persistence', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'documents'));
    expect(
      files.some((file) => /controller|repository|module/i.test(file)),
    ).toBe(false);
  });
});
