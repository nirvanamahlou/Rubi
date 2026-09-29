import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TourDepartureV1, TourPackageV1 } from '@nora/contracts';
import { TourOverview, tourMetrics, tourDay, tourDate } from './tour-overview';
const pack: TourPackageV1 = {
  id: 'p',
  version: 1,
  branchId: 'b',
  createdAt: '2026-01-01',
  name: 'تور آنتالیا',
  originId: 'origin',
  destinationId: 'destination',
  hotelIds: [],
  visa: false,
  transferOutbound: false,
  transferReturn: false,
};
const departure = (
  startsOn: string,
  endsOn: string,
  remainingCapacity = 10,
): TourDepartureV1 => ({
  id: startsOn,
  version: 1,
  branchId: 'b',
  packageId: 'p',
  packageVersion: 1,
  package: pack,
  startsOn,
  endsOn,
  outboundOfferId: 'o',
  remainingCapacity,
  outbound: {
    id: 'o',
    version: 1,
    branchId: 'b',
    originId: 'origin',
    destinationId: 'destination',
    departureAt: startsOn + 'T12:00:00Z',
    arrivalAt: startsOn + 'T15:00:00Z',
    carrierName: 'Airline',
    serviceNumber: '123',
    cabinClassCode: 'ECONOMY',
    totalCapacity: 20,
    remainingCapacity,
    status: 'ACTIVE',
  },
});
describe('tour overview', () => {
  it('counts ongoing, upcoming and saleable departures separately including date boundaries', () => {
    expect(
      tourMetrics(
        [
          departure('2026-09-27', '2026-09-28', 0),
          departure('2026-09-28', '2026-09-29'),
          departure('2026-09-29', '2026-09-30'),
          departure('2026-10-01', '2026-10-02', 0),
          departure('2026-09-01', '2026-09-02'),
        ],
        '2026-09-28',
      ),
    ).toEqual({ current: 2, upcoming: 2, available: 1 });
  });
  it('uses Tehran calendar day at a UTC date boundary', () => {
    expect(tourDay(new Date('2026-09-27T21:00:00Z'))).toBe('2026-09-28');
    expect(tourDate('2026-09-28')).toContain('۱۴۰۵');
  });
  it('renders actual route, edit actions, search and capacity without summing shared seats', () => {
    const html = renderToStaticMarkup(
      <TourOverview
        packages={[pack]}
        departures={[departure('2099-01-01', '2099-01-05')]}
        cities={[
          { id: 'origin', name: 'تهران' },
          { id: 'destination', name: 'آنتالیا' },
        ]}
        loading={false}
        busy={false}
        onEdit={() => {}}
        onSelect={() => {}}
        onRepeat={() => {}}
      />,
    );
    expect(html).toContain('تهران');
    expect(html).toContain('آنتالیا');
    expect(html).toContain('ویرایش تور');
    expect(html).toContain('ثبت نوبت');
    expect(html).toContain('aria-valuenow="10"');
    expect(html).toContain('جست‌وجوی تور');
  });
  it('offers deletion only in the standalone tour definition section', () => {
    const html = renderToStaticMarkup(
      <TourOverview
        definitionMode
        packages={[pack]}
        departures={[]}
        cities={[]}
        loading={false}
        busy={false}
        onEdit={() => {}}
        onDelete={() => {}}
        onSelect={() => {}}
        onRepeat={() => {}}
      />,
    );
    expect(html).toContain('حذف تور');
  });  it('renders loading placeholders instead of zero KPIs', () => {
    const html = renderToStaticMarkup(
      <TourOverview
        packages={[]}
        departures={[]}
        cities={[]}
        loading
        busy={false}
        onEdit={() => {}}
        onSelect={() => {}}
        onRepeat={() => {}}
      />,
    );
    expect(html).toContain('در حال دریافت تورها');
    expect(html).toContain('—');
    expect(html).not.toContain('اولین تور');
  });
});
