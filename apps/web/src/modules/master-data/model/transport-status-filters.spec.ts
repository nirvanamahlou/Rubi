import { describe, expect, it } from 'vitest';
import { transportStatusFilters } from './transport-status-filters';

describe('aircraft status visibility', () => {
  it.each(['active', 'inactive', 'all'] as const)(
    'ignores hidden base status %s for the aircraft all-status view',
    (status) => {
      expect(transportStatusFilters('aircraft-types', status, 'all')).toEqual({
        status: 'all',
      });
    },
  );
  it.each(['ACTIVE', 'INACTIVE', 'UNDER_REVIEW'] as const)(
    'keeps explicit aircraft filter %s authoritative',
    (transportStatus) => {
      expect(
        transportStatusFilters('aircraft-types', 'active', transportStatus),
      ).toEqual({ status: 'all', transportStatus });
    },
  );
  it('includes a saved inactive row in the default list after refresh', () => {
    const query = transportStatusFilters('aircraft-types', 'active', 'all');
    const afterSave = [
      { id: 'active', status: 'active' },
      { id: 'saved', status: 'inactive' },
    ];
    expect(
      afterSave.filter(
        (row) => query.status === 'all' || row.status === query.status,
      ),
    ).toHaveLength(2);
  });
  it.each(['active', 'inactive', 'all'] as const)(
    'preserves other resource base filter %s',
    (status) => {
      expect(transportStatusFilters('airlines', status, 'all')).toEqual({
        status,
      });
      expect(
        transportStatusFilters('cabin-classes', status, 'INACTIVE'),
      ).toEqual({ status, transportStatus: 'INACTIVE' });
    },
  );
});
