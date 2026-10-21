import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { MasterDataService } from './master-data.service';
import type { MasterDataRepository } from './master-data.repository';
import { changedDeniedFields } from '@nora/contracts';
import { masterDataAccessValues } from './master-data-access-values';

const permissions = ['ui.manual.v3', 'ui.allow.field.master-data.hotels.name'];
const current = {
  name: 'Hotel',
  freeSale: false,
  starRating: 5,
  address: null,
  roomTypeIds: ['room-1', 'room-2'],
  displayOrder: 0,
};
const submitted = {
  name: 'Updated hotel',
  freeSale: 'false',
  starRating: '5',
  address: '',
  roomTypeIds: 'room-1,room-2',
  displayOrder: '0',
};
const denied = (
  next: Record<string, unknown>,
  before?: Record<string, unknown>,
) =>
  changedDeniedFields(
    permissions,
    'field.master-data.hotels',
    masterDataAccessValues(next),
    before ? masterDataAccessValues(before) : undefined,
  );
describe('Master Data form access round trip', () => {
  it('accepts unchanged boolean, numeric, nullable and list fields without granting edits', () => {
    expect(denied(submitted, current)).toEqual([]);
  });
  it.each([
    ['freeSale', 'true'],
    ['starRating', '4'],
    ['address', 'New address'],
    ['roomTypeIds', 'room-2'],
    ['displayOrder', '1'],
  ])('still rejects actual restricted changes to %s', (field, value) => {
    expect(denied({ ...submitted, [field]: value }, current)).toEqual([field]);
  });
  it('still requires field grants on creation', () => {
    expect(denied(submitted)).toEqual([
      'freeSale',
      'starRating',
      'address',
      'roomTypeIds',
      'displayOrder',
    ]);
  });
  it('does not equate whitespace or differently ordered list values', () => {
    expect(
      denied(
        { ...submitted, roomTypeIds: 'room-2,room-1', address: ' ' },
        current,
      ),
    ).toEqual(['address', 'roomTypeIds']);
  });
});

it('allows a real hotel update with unchanged restricted form values and rejects a changed restriction', async () => {
  const hotel = {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'TEST',
    name: 'Hotel',
    isActive: true,
    version: 1,
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    freeSale: false,
    starRating: 5,
    address: null,
    displayOrder: 0,
  };
  const update = vi
    .fn()
    .mockResolvedValue({ ...hotel, name: 'Updated hotel', version: 2 });
  const repository = {
    find: vi.fn().mockResolvedValue(hotel),
    fieldExists: vi.fn().mockResolvedValue(false),
    update,
  } as unknown as MasterDataRepository;
  const actor = {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    branchIds: ['33333333-3333-4333-8333-333333333333'],
    permissions: [
      ...permissions,
      'ui.allow.master-data.resource.hotels',
      'master_data.update',
    ],
  } as AuthenticatedActor;
  const service = new MasterDataService(repository);
  const values = {
    name: 'Updated hotel',
    freeSale: 'false',
    starRating: '5',
    address: '',
    displayOrder: '0',
  };
  await expect(
    service.update('hotels', hotel.id, values, 1, actor),
  ).resolves.toBeDefined();
  expect(update).toHaveBeenCalledOnce();
  expect(update.mock.calls[0]?.[2]).toMatchObject({
    name: 'Updated hotel',
    freeSale: false,
    starRating: 5,
    displayOrder: 0,
  });
  await expect(
    service.update(
      'hotels',
      hotel.id,
      { ...values, freeSale: 'true' },
      1,
      actor,
    ),
  ).rejects.toMatchObject({
    response: {
      code: 'MASTER_DATA_FIELDS_RESTRICTED',
      controlIds: ['field.master-data.hotels.freeSale'],
    },
  });
  expect(update).toHaveBeenCalledOnce();
});
