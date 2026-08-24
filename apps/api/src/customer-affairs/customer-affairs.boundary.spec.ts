import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function productionSources() {
  const root = join(process.cwd(), 'src', 'customer-affairs');
  return readdirSync(root)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
}

describe('customer affairs phase A boundary', () => {
  it('contains only domain, local contracts and application ports', () => {
    const source = productionSources();
    expect(source).toContain('CustomerAffairsApplicationPort');
    expect(source).toContain('CUSTOMER_AFFAIRS_PHASE_A_NOTICE');
    expect(source).not.toMatch(
      /@rubi\/(?:database|contracts)|PrismaClient|@nestjs|Controller|Repository|\.\.\/iam|\.\.\/customers|master-data/,
    );
  });

  it('does not expose an active controller or repository file', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'customer-affairs'));
    expect(files.some((file) => /controller|repository/i.test(file))).toBe(
      false,
    );
  });
});
