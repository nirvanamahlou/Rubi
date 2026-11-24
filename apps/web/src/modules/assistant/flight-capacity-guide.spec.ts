import { describe, expect, it, vi } from 'vitest';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import catalog from './flight-capacity.generated.json';
import {
  readFlightCapacity,
  resolveFlightCapacityQuestion,
} from './flight-capacity-guide';

vi.mock('@/modules/ticket-catalog/api/tours', () => ({
  toursApi: { managedOffers: vi.fn() },
}));

const path = '/ticket-management';
const question = 'چند صندلی برای پرواز TK۱۲۳ در ۲۰۲۶-۱۲-۰۱ مانده؟';
const offer = {
  id: 'offer',
  version: 1,
  branchId: 'branch-a',
  originId: 'a',
  destinationId: 'b',
  carrierName: 'ایرلاین آزمایشی',
  serviceNumber: 'TK 123',
  departureAt: '2026-11-30T22:30:00Z',
  arrivalAt: '2026-12-01T02:00:00Z',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 40,
  remainingCapacity: 8,
  status: 'ACTIVE',
} as const;

describe('flight capacity guide', () => {
  it.each(catalog)('routes the example for $id', ({ id, examples }) => {
    expect(resolveFlightCapacityQuestion(examples[0]!, path)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
  });

  it('looks up an exact flight and date and continues a guide after navigation', () => {
    expect(resolveFlightCapacityQuestion(question, path)).toMatchObject({
      kind: 'read',
      lookup: { number: 'tk123', date: '2026-12-01' },
    });
    expect(
      resolveFlightCapacityQuestion('بعدش چی؟', '/workbench', 'create'),
    ).toMatchObject({ kind: 'guide', followUp: true });
    expect(
      resolveFlightCapacityQuestion('چند صندلی مانده؟', path),
    ).toMatchObject({ kind: 'clarify' });
    expect(
      resolveFlightCapacityQuestion('قیمت‌گذاری پرواز کجاست؟', path),
    ).toBeUndefined();
  });

  it('matches the Tehran departure day and respects scope and ambiguity', async () => {
    const signal = new AbortController().signal;
    const lookup = { number: 'tk123', date: '2026-12-01' };
    vi.mocked(toursApi.managedOffers).mockResolvedValueOnce({
      version: 1,
      data: [offer],
    });
    expect(await readFlightCapacity(lookup, ['branch-a'], signal)).toContain(
      'مانده: ۸',
    );
    vi.mocked(toursApi.managedOffers).mockResolvedValueOnce({
      version: 1,
      data: [offer],
    });
    expect(await readFlightCapacity(lookup, ['branch-b'], signal)).toContain(
      'پیدا نشد',
    );
    vi.mocked(toursApi.managedOffers).mockResolvedValueOnce({
      version: 1,
      data: [offer, { ...offer, id: 'other', cabinClassCode: 'BUSINESS' }],
    });
    expect(await readFlightCapacity(lookup, ['branch-a'], signal)).toContain(
      'چند ردیف',
    );
  });
});
