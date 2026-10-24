import { expect, it, vi } from 'vitest';
import { enforceSalesHotelCapacity } from '@nora/contracts';
import type {
  SalesContractCreateRequest,
  SalesContractDetail,
} from '@nora/contracts';
import { SalesService } from './sales.service';
it('temporarily allows unconfigured room capacity at save and confirmation without requesting a quote', async () => {
  expect(enforceSalesHotelCapacity()).toBe(false);
  const roomAvailability = vi
    .fn()
    .mockRejectedValue(new Error('no configured capacity'));
  const service = new SalesService(
    {} as never,
    {} as never,
    {} as never,
    undefined,
    { roomAvailability } as never,
  ) as unknown as {
    assertHotelRoomCapacity(
      input: SalesContractCreateRequest,
      branch: string,
    ): Promise<void>;
    assertPresentedHotelRoomCapacity(input: SalesContractDetail): Promise<void>;
  };
  const hotelSelection = {
    rooms: [{ adults: 1, childAges: [] }],
    roomCount: 1,
  };
  await expect(
    service.assertHotelRoomCapacity(
      { hotelSelection } as unknown as SalesContractCreateRequest,
      'branch',
    ),
  ).resolves.toBeUndefined();
  await expect(
    service.assertPresentedHotelRoomCapacity({
      hotelSelection,
    } as unknown as SalesContractDetail),
  ).resolves.toBeUndefined();
  expect(roomAvailability).not.toHaveBeenCalled();
});
