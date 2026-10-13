import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { MasterOrganizationDirectory } from './master-organization-directory';

const organizationId = '11111111-1111-4111-8111-111111111111';
const addressId = '22222222-2222-4222-8222-222222222222';
const countryId = '33333333-3333-4333-8333-333333333333';
const cityId = '44444444-4444-4444-8444-444444444444';
const branchId = '55555555-5555-4555-8555-555555555555';
const actor: AuthenticatedActor = {
  userId: '66666666-6666-4666-8666-666666666666',
  sessionId: '77777777-7777-4777-8777-777777777777',
  branchIds: [branchId],
  permissions: ['master_data.update'],
};
const now = new Date('2026-10-04T00:00:00.000Z');

function address(overrides: Record<string, unknown> = {}) {
  return {
    id: addressId,
    organizationId,
    countryId,
    cityId,
    label: 'دفتر آزمون',
    postalCode: null,
    addressLine: 'تهران، خیابان آزمون',
    isPrimary: false,
    displayOrder: 0,
    isActive: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
    country: { name: 'ایران' },
    city: { name: 'تهران' },
    ...overrides,
  };
}

function setup(before = address()) {
  const transaction = {
    masterOrganizationAddress: {
      findFirst: vi.fn().mockResolvedValue(before),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    masterCity: { findFirst: vi.fn().mockResolvedValue({ id: cityId }) },
    masterDataAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const client = {
    masterOrganization: {
      findUnique: vi.fn().mockResolvedValue({ id: organizationId }),
    },
    masterCity: { findFirst: vi.fn().mockResolvedValue({ id: cityId }) },
    $transaction: vi.fn(
      async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction),
    ),
  };
  return {
    directory: new MasterOrganizationDirectory({
      client,
    } as unknown as DatabaseService),
    client,
    transaction,
  };
}

describe('MasterOrganizationDirectory address geography', () => {
  it('creates a text address with an explicitly null geography projection', async () => {
    const { directory, client, transaction } = setup();
    transaction.masterOrganizationAddress.create.mockResolvedValue(
      address({
        countryId: null,
        cityId: null,
        country: null,
        city: null,
      }),
    );

    const result = await directory.createAddress(
      organizationId,
      { label: 'نشانی همکاری', addressLine: '  تهران، خیابان آزمون  ' },
      actor,
    );

    expect(result).toMatchObject({
      countryId: null,
      countryName: null,
      cityId: null,
      cityName: null,
      addressLine: 'تهران، خیابان آزمون',
    });
    expect(transaction.masterOrganizationAddress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countryId: null,
          cityId: null,
          addressLine: 'تهران، خیابان آزمون',
        }),
      }),
    );
    expect(client.masterCity.findFirst).not.toHaveBeenCalled();
  });

  it('preserves an existing pair when PATCH omits geography', async () => {
    const { directory, transaction } = setup();
    transaction.masterOrganizationAddress.findUniqueOrThrow.mockResolvedValue(
      address({ version: 2, label: 'دفتر ویرایش‌شده' }),
    );

    const result = await directory.updateAddress(
      organizationId,
      addressId,
      {
        version: 1,
        label: 'دفتر ویرایش‌شده',
        addressLine: 'تهران، خیابان آزمون',
      },
      actor,
    );

    expect(result).toMatchObject({ countryId, cityId, version: 2 });
    expect(transaction.masterCity.findFirst).toHaveBeenCalledWith({
      where: { id: cityId, countryId },
      select: { id: true },
    });
    expect(
      transaction.masterOrganizationAddress.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ countryId, cityId }),
      }),
    );
  });

  it('clears both geography values and rejects partial pairs', async () => {
    const { directory, transaction } = setup();
    transaction.masterOrganizationAddress.findUniqueOrThrow.mockResolvedValue(
      address({
        version: 2,
        countryId: null,
        cityId: null,
        country: null,
        city: null,
      }),
    );

    const result = await directory.updateAddress(
      organizationId,
      addressId,
      {
        version: 1,
        label: 'دفتر آزمون',
        addressLine: 'تهران، خیابان آزمون',
        countryId: null,
        cityId: null,
      },
      actor,
    );
    expect(result).toMatchObject({ countryId: null, cityId: null });
    expect(transaction.masterCity.findFirst).not.toHaveBeenCalled();

    await expect(
      directory.updateAddress(
        organizationId,
        addressId,
        {
          version: 1,
          label: 'دفتر آزمون',
          addressLine: 'تهران، خیابان آزمون',
          countryId,
          cityId: null,
        },
        actor,
      ),
    ).rejects.toThrow('با هم');
  });
});
