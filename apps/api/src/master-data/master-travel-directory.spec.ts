import { describe, expect, it, vi } from 'vitest';
import { MasterTravelDirectory } from './master-travel-directory';
import type { MasterDataService } from './master-data.service';

describe('public travel reference boundary', () => {
  const input = {
    originId: 'origin',
    destinationId: 'destination',
    hotelIds: ['hotel'],
    insuranceId: 'plan',
  };
  it('resolves through the public master service and rejects the wrong hotel city', async () => {
    const detail = vi.fn(async () => ({
      data: { status: 'active', attributes: { cityId: 'destination' } },
    }));
    const directory = new MasterTravelDirectory({
      detail,
    } as unknown as MasterDataService);
    await expect(
      directory.assertTourReferences(input),
    ).resolves.toBeUndefined();
    expect(detail.mock.calls).toHaveLength(4);
    detail.mockResolvedValue({
      data: { status: 'active', attributes: { cityId: 'other' } },
    });
    await expect(directory.assertTourReferences(input)).rejects.toThrow(
      'شهر مقصد',
    );
  });
  it('rejects inactive references rather than pretending they are available', async () => {
    const detail = vi.fn(async () => ({
      data: { status: 'inactive', attributes: {} },
    }));
    const directory = new MasterTravelDirectory({
      detail,
    } as unknown as MasterDataService);
    await expect(directory.assertTourReferences(input)).rejects.toThrow();
  });
});
