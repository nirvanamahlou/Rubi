import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { ReportingRepository } from './reporting.repository';

describe('catalog favorites persistence', () => {
  it('binds the favorite filter state as JSON text explicitly cast to jsonb', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'favorite-1' }]);
    const repository = new ReportingRepository({
      client: { $queryRaw: queryRaw },
    } as unknown as DatabaseService);
    const result = await repository.createSaved('00000000-0000-4000-8000-000000000001', {
      reportCode: 'sales_by_organization',
      name: 'فروش',
      sharingScope: 'PERSONAL',
      isFavorite: true,
      filterState: { catalogFavorite: true },
    });

    expect(result).toEqual({ id: 'favorite-1' });
    const statement = queryRaw.mock.calls[0]?.[0] as { strings: readonly string[]; values: readonly unknown[] };
    expect(statement.strings.join('')).toContain('::jsonb');
    expect(statement.values).toContain('{"catalogFavorite":true}');
  });
});
