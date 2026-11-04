import { expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { enrichContractHotels } from './contract-hotel-references';
import { printFixture } from './contract-print.fixture';
import type { ContractPrintReferences } from './contract-print';
it('resolves the English city through each actual hotel instead of the contract destination or stale saved city', async () => {
  const output = structuredClone(printFixture);
  output.contract.hotelSelection!.additionalStays = [
    {
      hotelId: 'second',
      hotelNameSnapshot: 'SECOND',
      cityId: 'wrong-city',
      checkInDate: '2026-10-05',
      checkOutDate: '2026-10-08',
    },
  ];
  const read = vi.fn(
    async (resource: string, id: string) =>
      ({
        id,
        name: resource === 'cities' ? 'فارسی' : 'Hotel',
        attributes:
          resource === 'hotels'
            ? {
                cityId: id === 'second' ? 'izmir' : 'antalya',
                englishName: id === 'second' ? 'Second Hotel' : 'First Hotel',
              }
            : { englishName: id === 'izmir' ? 'IZMIR' : 'ANTALYA' },
      }) as unknown as MasterDataRecord,
  );
  const refs: ContractPrintReferences = { names: {} };
  await enrichContractHotels(output, refs, read);
  expect(refs.hotels!.second).toMatchObject({
    name: 'Second Hotel',
    city: 'IZMIR',
  });
  expect(read).not.toHaveBeenCalledWith('cities', 'wrong-city');
  expect(output.contract.hotelSelection!.additionalStays[0]!.cityId).toBe(
    'wrong-city',
  );
});
it('keeps a saved hotel name and an honest missing-city value when optional references are unavailable', async () => {
  const refs: ContractPrintReferences = { names: {} };
  await enrichContractHotels(printFixture, refs, async () => {
    throw Error('offline');
  });
  expect(
    refs.hotels![printFixture.contract.hotelSelection!.hotelId],
  ).toMatchObject({
    name: printFixture.contract.hotelSelection!.hotelNameSnapshot,
  });
  expect(
    refs.hotels![printFixture.contract.hotelSelection!.hotelId],
  ).not.toHaveProperty('city');
});
