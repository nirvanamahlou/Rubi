import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('customer affairs integration adapter boundary', () => {
  const source = readFileSync(
    join(
      process.cwd(),
      'src',
      'customer-affairs',
      'customer-affairs.adapters.ts',
    ),
    'utf8',
  );

  it('consumes only the public Customers contract', () => {
    expect(source).toContain("from '@rubi/contracts'");
    expect(source).toContain('CustomerListQuery');
    expect(source).toContain('CustomerListResponse');
    expect(source).toContain('CustomerDetail');
    expect(source).not.toMatch(
      /Prisma|Repository|\.\.\/customers|src\/customers|customer\.domain/,
    );
  });

  it('keeps Sales and Reservations adapters proposal-only', () => {
    expect(source).toContain('CustomerAffairsSalesAdapter');
    expect(source).toContain('CustomerAffairsReservationsAdapter');
    expect(source).toContain('persisted: false');
    expect(source).not.toMatch(
      /createContract|createReservation|publish|emit/i,
    );
  });
});
