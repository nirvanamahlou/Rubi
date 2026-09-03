import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AwaitingTicketCatalogPublicApi } from './sales.adapters';

const salesRoot = join(process.cwd(), 'src', 'sales');

describe('Sales module boundary', () => {
  it('does not query another module table or repository', () => {
    const repository = readFileSync(join(salesRoot, 'sales.repository.ts'), 'utf8');
    expect(repository).not.toMatch(/\.(customer|ticket|finance|reservation|document|legalEntity)\w*\.(find|create|update|delete|count)/i);
    expect(repository).not.toMatch(/from ['"]\.\.\/(customers|ticket-catalog|finance|documents|legal-entities)\/.*repository/);
  });

  it('fails closed while the Ticket Management public API is unavailable', async () => {
    const adapter = new AwaitingTicketCatalogPublicApi();
    await expect(adapter.revalidate(['offer-1'])).resolves.toEqual({ available: false, unavailableOfferIds: ['offer-1'] });
    await expect(adapter.revalidate([])).resolves.toEqual({ available: true, unavailableOfferIds: [] });
  });
});
