import { describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
const masterList = vi.hoisted(() => vi.fn());
vi.mock('./travel-workflow-form', () => ({ travelRequest: request }));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: { list: masterList },
}));
import { loadReservationEditReferences } from './reservation-settings';
import { searchOptions } from '@/components/ui/search-combobox';

describe('reservation supplier directory', () => {
  it('loads every page through the reservation-scoped endpoint and searches inside names', async () => {
    request.mockResolvedValueOnce({
      data: [{ id: 'a', name: 'First Broker' }],
      meta: { total: 2 },
    });
    request.mockResolvedValueOnce({
      data: [{ id: 'b', name: 'Second Broker' }],
      meta: { total: 2 },
    });
    const options = await loadReservationEditReferences(
      'brokers',
      'request-id',
    );
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      'reservations/requests/request-id/voucher-brokers?page=1',
      'reservations/requests/request-id/voucher-brokers?page=2',
    ]);
    expect(masterList).not.toHaveBeenCalled();
    expect(
      searchOptions(
        options.map((option) => ({ ...option, value: option.id })),
        'ond Bro',
      ),
    ).toEqual([
      expect.objectContaining({ value: 'b', label: 'Second Broker' }),
    ]);
  });
});
