import type {
  LoginResponse,
  PackageTourHotelPurchaseBatchV1,
  PackageTourPublicationV1,
  TourDepartureV1,
} from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import {
  buildPackageBannerViewModel,
  canViewPackageBanner,
  packageBannerHref,
} from './package-banner';

const tour: TourDepartureV1 = {
  id: 'departure-1',
  version: 2,
  branchId: 'branch-1',
  packageId: 'tour-package-1',
  packageVersion: 1,
  startsOn: '2026-10-10',
  endsOn: '2026-10-15',
  outboundOfferId: 'offer-out',
  returnOfferId: 'offer-back',
  remainingCapacity: 12,
  package: {
    id: 'tour-package-1',
    version: 1,
    branchId: 'branch-1',
    createdAt: '2026-09-01T00:00:00Z',
    name: 'تور آنتالیا',
    originId: 'tehran',
    destinationId: 'antalya',
    hotelIds: ['hotel-1'],
    transferOutbound: true,
    transferReturn: true,
    visa: false,
    details: {
      version: 1,
      itinerary: [
        { kind: 'START', location: 'تهران' },
        { kind: 'STAY', location: 'آنتالیا' },
      ],
    },
  },
  outbound: {
    id: 'offer-out',
    version: 1,
    branchId: 'branch-1',
    originId: 'tehran',
    destinationId: 'antalya',
    departureAt: '2026-10-10T08:00:00Z',
    arrivalAt: '2026-10-10T11:00:00Z',
    carrierName: 'ماهان',
    serviceNumber: 'W5-112',
    cabinClassCode: 'ECONOMY',
    totalCapacity: 20,
    remainingCapacity: 12,
    status: 'ACTIVE',
  },
  returning: {
    id: 'offer-back',
    version: 1,
    branchId: 'branch-1',
    originId: 'antalya',
    destinationId: 'tehran',
    departureAt: '2026-10-15T15:00:00Z',
    arrivalAt: '2026-10-15T18:00:00Z',
    carrierName: 'ماهان',
    serviceNumber: 'W5-113',
    cabinClassCode: 'ECONOMY',
    totalCapacity: 20,
    remainingCapacity: 12,
    status: 'ACTIVE',
  },
};

const batch: PackageTourHotelPurchaseBatchV1 = {
  id: 'batch-1',
  version: 1,
  branchId: 'branch-1',
  tourDepartureId: 'departure-1',
  checkIn: '2026-10-10',
  checkOut: '2026-10-15',
  method: 'STAY',
  currencyCode: 'EUR',
  observedAt: '2026-09-20T10:00:00Z',
  rows: [
    {
      id: 'rate-1',
      version: 1,
      batchId: 'batch-1',
      hotelId: 'hotel-1',
      hotelName: 'هتل ساحلی آنتالیا',
      brokerId: 'broker-secret',
      brokerName: 'کارگزار محرمانه',
      basePerNight: '100',
      currencyCode: 'EUR',
      factors: { double: '2', single: '' },
      roomRates: [],
    },
  ],
};

const publication: PackageTourPublicationV1 = {
  version: 1,
  id: 'publication-1',
  draftId: 'draft-1',
  priceVersion: 3,
  draftVersion: 2,
  tourVersion: 2,
  currencyCode: 'EUR',
  adultFlightSale: '300',
  childFlightSale: '200',
  businessUplift: '0',
  commissionPercent: '10',
  outboundCostRevisionId: 'private-cost',
  returnCostRevisionId: 'private-return-cost',
  publishedAt: '2026-09-21T10:00:00Z',
  roomPrices: [
    {
      hotelRateId: 'rate-1',
      roomCode: 'double',
      hotelPurchase: '500',
      hotelSale: '600',
      packagePurchase: '700',
      packageSale: '950',
      commissionAmount: '95',
      netProfit: '155',
      currencyCode: 'EUR',
    },
    {
      hotelRateId: 'rate-1',
      roomCode: 'single',
      hotelPurchase: '500',
      hotelSale: '600',
      packagePurchase: '700',
      packageSale: '1100',
      commissionAmount: '110',
      netProfit: '290',
      currencyCode: 'EUR',
    },
  ],
};

describe('package banner view model', () => {
  it('uses only saleable rooms and public sale prices', () => {
    const result = buildPackageBannerViewModel({ tour, batch, publication });
    expect(result.failures).toEqual([]);
    expect(result.value).toMatchObject({
      packageName: 'تور آنتالیا',
      destination: 'آنتالیا',
      route: 'تهران ← آنتالیا',
      flight: 'ماهان · W5-112',
      publicationStatus: 'منتشرشده',
      displayPrices: [{ amount: '950', currencyCode: 'EUR' }],
      rooms: [
        {
          hotelName: 'هتل ساحلی آنتالیا',
          roomName: 'دوتخته',
          prices: [{ amount: '950', currencyCode: 'EUR' }],
        },
      ],
    });
    expect(JSON.stringify(result.value)).not.toContain('broker-secret');
    expect(JSON.stringify(result.value)).not.toContain('private-cost');
    expect(JSON.stringify(result.value)).not.toContain('hotelPurchase');
    expect(JSON.stringify(result.value)).not.toContain('commission');
    expect(JSON.stringify(result.value)).not.toContain('profit');
  });

  it('fails closed when no room has both a valid factor and sale price', () => {
    const result = buildPackageBannerViewModel({
      tour,
      batch: {
        ...batch,
        rows: [{ ...batch.rows[0]!, factors: { double: '' } }],
      },
      publication,
    });
    expect(result.value).toBeNull();
    expect(result.failures).toEqual([
      'SALE_PRICE_MISSING',
      'SALEABLE_ROOM_MISSING',
    ]);
  });

  it('fails closed for invalid destination, dates and inactive flight', () => {
    const packageWithoutDetails = { ...tour.package };
    delete packageWithoutDetails.details;
    const result = buildPackageBannerViewModel({
      tour: {
        ...tour,
        startsOn: 'invalid',
        package: { ...packageWithoutDetails, destinationId: '' },
        outbound: { ...tour.outbound, status: 'PAUSED' },
      },
      batch,
      publication,
    });
    expect(result.value).toBeNull();
    expect(result.failures).toEqual([
      'DESTINATION_MISSING',
      'TRAVEL_WINDOW_INVALID',
      'FLIGHT_MISSING',
    ]);
  });

  it('requires read and render permissions and preserves management selection in links', () => {
    const session = (
      permissions: LoginResponse['user']['permissions'],
    ): LoginResponse => ({
      user: {
        id: 'user-1',
        username: 'seller',
        email: null,
        displayName: 'فروشنده',
        permissions,
        branches: [{ id: 'branch-1', code: 'THR', name: 'تهران' }],
      },
    });
    expect(canViewPackageBanner(session(['package_pricing.read']))).toBe(false);
    expect(
      canViewPackageBanner(
        session(['package_pricing.read', 'package_pricing.render']),
      ),
    ).toBe(true);
    const href = packageBannerHref({
      packageId: 'departure/1',
      tourPackageId: 'tour-1',
      batchId: 'batch-1',
      publicationId: 'publication-1',
    });
    expect(href).toContain('/sales/pricing/packages/departure%2F1/banner?');
    const query = new URL(href, 'https://rubi.local').searchParams;
    expect(query.get('batchId')).toBe('batch-1');
    expect(query.get('publicationId')).toBe('publication-1');
    expect(query.get('returnTo')).toContain(
      '/sales/pricing/management?package=tour-1&departure=departure%2F1&batch=batch-1&publication=publication-1',
    );
  });
});
