import { beforeEach, expect, it, vi } from 'vitest';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
const h = vi.hoisted(() => ({
  render: vi.fn(async () => Buffer.from('%PDF-synthetic')),
}));
vi.mock('./reservation-pdf', () => ({ renderReservationPdf: h.render }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
vi.mock('@/modules/travel-documents/server/public-document-store', () => ({
  createPublicDocument: () => null,
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => 'synthetic css'),
}));
import { GET } from '@/app/reservations/requests/[id]/pdf/route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it('loads every hotel city and room reference before rendering the full issued voucher, under the existing cookie guard', async () => {
  const { intake, refs } = voucherServiceFixture();
  intake.workflow.voucherIssued = true;
  intake.workflow.voucherSettings!.brokerId = intake.id;
  intake.workflow.voucherSettings!.leaderId = intake.id;
  intake.snapshot.hotelSelection!.additionalStays = [
    {
      hotelId: 'second-hotel',
      hotelNameSnapshot: 'SECOND',
      cityId: 'second-city',
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-09',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'second-room',
          roomTypeNameSnapshot: 'SINGLE',
          roomCategory: 'SINGLE',
          adults: 1,
          childAges: [],
        },
      ],
    },
  ];
  const fetcher = vi.fn(async (input: string) => {
    if (input.endsWith('/workflow')) return Response.json({ data: intake });
    if (input.includes('?')) return Response.json({ data: [] });
    const id = input.split('/').pop()!;
    return Response.json({
      data: refs[id] ?? {
        id,
        name: id.toUpperCase(),
        attributes: { englishName: id.toUpperCase() },
      },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  const result = await GET(
    new Request(
      'http://localhost/reservations/requests/' +
        intake.id +
        '/pdf?kind=voucher',
      { headers: { cookie: 'synthetic-session' } },
    ),
    { params: Promise.resolve({ id: intake.id }) },
  );
  expect(result.status).toBe(200);
  expect(result.headers.get('Content-Disposition')).toContain('hotel-voucher-');
  const [output, references] = h.render.mock.calls[0]! as unknown as [
    typeof intake,
    typeof refs,
  ];
  expect(output.snapshot.hotelSelection?.additionalStays).toHaveLength(1);
  for (const id of ['second-hotel', 'second-city', 'second-room'])
    expect(references[id]?.name).toBe(id.toUpperCase());
  expect(fetcher.mock.calls.map((call) => call[0])).toContain(
    'http://api.test/api/v1/master-data/room-types/second-room',
  );
});
