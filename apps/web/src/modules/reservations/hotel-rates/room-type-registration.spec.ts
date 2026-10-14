import { describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import {
  registerRoomTypeForHotel,
  type HotelRoomTypeApi,
} from './room-type-registration';

const record = (
  resource: 'hotels' | 'room-types',
  input: Partial<MasterDataRecord> = {},
): MasterDataRecord => ({
  id: resource === 'hotels' ? 'hotel-1' : 'room-1',
  resource,
  code: resource === 'hotels' ? 'HOTEL_ONE' : 'ROOM_ONE',
  name: resource === 'hotels' ? 'هتل آزمون' : 'دریا',
  status: 'active',
  attributes: resource === 'hotels' ? { cityId: 'city-1' } : {},
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...input,
});

function api(overrides: Partial<HotelRoomTypeApi> = {}): HotelRoomTypeApi {
  return {
    detail: vi.fn().mockResolvedValue({ data: record('hotels') }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({
      data: record('room-types', { id: 'room-new', name: 'دریا' }),
    }),
    update: vi.fn().mockResolvedValue({ data: record('hotels') }),
    ...overrides,
  };
}

const permissions = [
  'master_data.read',
  'master_data.create',
  'master_data.update',
];

describe('registerRoomTypeForHotel', () => {
  it('creates a canonical room type and appends it without replacing linked types', async () => {
    const client = api({
      detail: vi
        .fn()
        .mockResolvedValueOnce({
          data: record('hotels', {
            attributes: {
              cityId: 'city-1',
              roomTypeIds: 'room-old,room-older',
            },
          }),
        })
        .mockResolvedValueOnce({
          data: record('hotels', {
            attributes: {
              cityId: 'city-1',
              roomTypeIds: 'room-old,room-older',
            },
          }),
        }),
    });

    const result = await registerRoomTypeForHotel(
      { hotelId: 'hotel-1', cityId: 'city-1', name: ' دریا ', permissions },
      client,
    );

    expect(result).toEqual({ id: 'room-new', name: 'دریا' });
    expect(client.create).toHaveBeenCalledWith('room-types', {
      values: { name: 'دریا' },
    });
    expect(client.update).toHaveBeenCalledWith('hotels', 'hotel-1', {
      version: 3,
      values: { roomTypeIds: ['room-old', 'room-older', 'room-new'] },
    });
  });

  it('reuses an existing active room type and is idempotent when already linked', async () => {
    const client = api({
      list: vi.fn().mockResolvedValue({
        data: [record('room-types', { id: 'room-existing', name: 'دریا' })],
      }),
      detail: vi.fn().mockResolvedValue({
        data: record('hotels', {
          attributes: { cityId: 'city-1', roomTypeIds: 'room-existing' },
        }),
      }),
    });

    await expect(
      registerRoomTypeForHotel(
        {
          hotelId: 'hotel-1',
          cityId: 'city-1',
          name: ' دریا ',
          permissions: ['master_data.read', 'master_data.update'],
        },
        client,
      ),
    ).resolves.toEqual({ id: 'room-existing', name: 'دریا' });
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
  });

  it('checks create permission only when the canonical type does not exist', async () => {
    const client = api();
    await expect(
      registerRoomTypeForHotel(
        {
          hotelId: 'hotel-1',
          cityId: 'city-1',
          name: 'دریا',
          permissions: ['master_data.read', 'master_data.update'],
        },
        client,
      ),
    ).rejects.toThrow('مجوز ایجاد اطلاعات پایه');
    expect(client.update).not.toHaveBeenCalled();
  });

  it('rejects an inactive type and a hotel outside the selected city', async () => {
    const inactiveApi = api({
      list: vi.fn().mockResolvedValue({
        data: [record('room-types', { name: 'دریا', status: 'inactive' })],
      }),
    });
    await expect(
      registerRoomTypeForHotel(
        { hotelId: 'hotel-1', cityId: 'city-1', name: 'دریا', permissions },
        inactiveApi,
      ),
    ).rejects.toThrow('غیرفعال است');
    expect(inactiveApi.create).not.toHaveBeenCalled();

    const wrongCityApi = api({
      detail: vi.fn().mockResolvedValue({
        data: record('hotels', { attributes: { cityId: 'city-other' } }),
      }),
    });
    await expect(
      registerRoomTypeForHotel(
        { hotelId: 'hotel-1', cityId: 'city-1', name: 'دریا', permissions },
        wrongCityApi,
      ),
    ).rejects.toThrow('شهر انتخاب‌شده');
    expect(wrongCityApi.list).not.toHaveBeenCalled();
  });

  it('surfaces a clear partial failure when the hotel link is rejected', async () => {
    const client = api({ update: vi.fn().mockRejectedValue(new Error('409')) });
    await expect(
      registerRoomTypeForHotel(
        { hotelId: 'hotel-1', cityId: 'city-1', name: 'دریا', permissions },
        client,
      ),
    ).rejects.toThrow('ساخته شد اما به هتل وصل نشد');
  });
});
