import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
const masterList = vi.hoisted(() => vi.fn());
vi.mock('./travel-workflow-form', () => ({ travelRequest: request }));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: { list: masterList },
}));
import { loadReservationEditReferences } from './reservation-settings';
import { searchOptions } from '@/components/ui/search-combobox';
import { findReservationEditReference } from '../model/reservation-edit-references';

describe('reservation supplier directory', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses English output names and resolves saved Persian selections', async () => {
    request.mockResolvedValueOnce({
      data: [
        { id: 'broker', name: 'کارگزار نمونه', englishName: ' Sample Broker ' },
      ],
      meta: { total: 1 },
    });
    const options = await loadReservationEditReferences(
      'brokers',
      'request-id',
    );
    expect(findReservationEditReference('کارگزار نمونه', options)?.label).toBe(
      'Sample Broker',
    );
    expect(findReservationEditReference('Sample Broker', options)?.id).toBe(
      'broker',
    );
    expect(
      searchOptions(
        options.map((option) => ({ ...option, value: option.id })),
        'کارگزار',
      ),
    ).toHaveLength(1);
  });
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

import { sendSavedReservationForm } from './reservation-settings';
it('requires a broker even without transfer and does not request a PDF for an incomplete form', async () => {
  const send = vi.fn();
  vi.stubGlobal('fetch', send);
  try {
    await expect(
      sendSavedReservationForm(
        'r',
        { version: 5, supplierFormSettings: {} } as never,
        undefined,
        false,
      ),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it('asks the server to render and mail the saved PDF using its exact version and hotel scope', async () => {
  const send = vi
    .fn()
    .mockResolvedValue(Response.json({ data: { version: 6 } }));
  vi.stubGlobal('fetch', send);
  try {
    const result = await sendSavedReservationForm(
      'r',
      {
        version: 5,
        hotelSupplierForms: { hotel: { settings: { brokerId: 'b' } } },
      } as never,
      'hotel',
    );
    expect(send).toHaveBeenCalledWith(
      '/reservations/requests/r/pdf',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ expectedVersion: 5, hotelStayKey: 'hotel' }),
      }),
    );
    expect(result.data.version).toBe(6);
  } finally {
    vi.unstubAllGlobals();
  }
});
it('shows a server rendering/send failure without claiming that an email was sent', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: 'PDF_NOT_READY' }, { status: 503 }),
      ),
  );
  try {
    await expect(
      sendSavedReservationForm('r', {
        version: 5,
        supplierFormSettings: { brokerId: 'b' },
      } as never),
    ).rejects.toThrow('PDF_NOT_READY');
  } finally {
    vi.unstubAllGlobals();
  }
});
