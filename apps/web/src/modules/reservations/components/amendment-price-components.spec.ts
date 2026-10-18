import { expect, it } from 'vitest';
import {
  PASSENGER_FLIGHT_PRICES,
  type SalesContractAmendmentV1,
} from '@nora/contracts';
import { amendmentPriceComponents } from './amendment-price-components';
it('recalculates flight and edited room totals separately per currency without double charging', () => {
  const draft = {
    services: [
      {
        clientKey: 'flight',
        kind: 'FLIGHT',
        metadata: {
          automaticFlightRoomTotalV1: true,
          [PASSENGER_FLIGHT_PRICES]: JSON.stringify({
            p: [{ amount: '1000', currencyCode: 'IRR' }],
          }),
        },
      },
    ],
    hotelSelection: {
      rooms: [
        { agreedPrice: { amount: '45.5', currencyCode: 'EUR' } },
        { agreedPrice: { amount: '20', currencyCode: 'EUR' } },
      ],
    },
  } as unknown as SalesContractAmendmentV1;
  expect(
    amendmentPriceComponents(draft)?.map((p) => [p.currencyCode, p.amount]),
  ).toEqual([
    ['IRR', '1000'],
    ['EUR', '65.5'],
  ]);
  draft.hotelSelection!.rooms![0]!.agreedPrice!.amount = '50';
  expect(
    amendmentPriceComponents(draft)?.map((p) => [p.currencyCode, p.amount]),
  ).toEqual([
    ['IRR', '1000'],
    ['EUR', '70'],
  ]);
});
