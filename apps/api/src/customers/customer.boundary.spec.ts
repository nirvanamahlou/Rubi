import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('customer phase A boundary', () => {
  it('contains design only and no persistence or internal module access', () => {
    const root = join(process.cwd(), 'src', 'customers');
    const source = ['customer.contracts.ts', 'customer.domain.ts']
      .map((file) => readFileSync(join(root, file), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /@rubi\/database|PrismaClient|RepositoryImpl|\.\.\/iam|master-data/,
    );
    expect(source).toContain('CustomerApplicationPort');
  });
  it('keeps active customer operations independent from Legal Entity context', () => {
    const root = join(process.cwd(), 'src', 'customers');
    const source = [
      'customers.controller.ts',
      'customer.service.ts',
      'customer.repository.ts',
    ]
      .map((file) => readFileSync(join(root, file), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(
      /legal-entit|legalEntity|issuerContext|issuerId|master-data.*repository/i,
    );
  });
});
