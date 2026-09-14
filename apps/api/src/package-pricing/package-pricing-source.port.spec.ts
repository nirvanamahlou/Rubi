import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  FailClosedPackagePricingSourceAdapter,
  VersionedPackagePricingSourceAdapter,
} from './package-pricing-source.port';

describe('FailClosedPackagePricingSourceAdapter', () => {
  const adapter = new FailClosedPackagePricingSourceAdapter();

  it('never creates a price when upstream rate contracts are missing', async () => {
    await expect(adapter.resolve()).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SOURCE_RATE_UNAVAILABLE' }),
    });
  });

  it('never publishes without a fresh upstream capacity recheck', async () => {
    await expect(adapter.recheck()).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(adapter.recheck()).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CAPACITY_RECHECK_FAILED' }),
    });
  });
});

describe('VersionedPackagePricingSourceAdapter', () => {
  it('passes versioned hotel base rates through the Master Data public contract', async () => {
    const reference = {
      owner: 'MASTER_DATA' as const,
      kind: 'HOTEL_BASE_RATE',
      id: 'rate-row',
      version: 3,
    };
    const resolveRateReferences = vi.fn().mockResolvedValue([
      {
        reference,
        amount: '125.5',
        currencyCode: 'EUR',
        observedAt: '2026-09-14T00:00:00.000Z',
        snapshot: { periodVersion: 3 },
      },
    ]);
    const recheckRateReferences = vi.fn().mockResolvedValue(undefined);
    const adapter = new VersionedPackagePricingSourceAdapter({
      resolveRateReferences,
      recheckRateReferences,
    } as never);

    await expect(
      adapter.resolve([reference], 'branch', 'EUR'),
    ).resolves.toEqual({
      sources: [
        expect.objectContaining({
          reference,
          amount: '125.5',
          capacity: null,
          approved: true,
        }),
      ],
      fxSnapshot: null,
    });
    await adapter.recheck(
      [
        {
          reference,
          amount: '125.5',
          currencyCode: 'EUR',
          capacity: null,
          observedAt: '2026-09-14T00:00:00.000Z',
          approved: true,
          snapshot: {},
        },
      ],
      'branch',
    );
    expect(recheckRateReferences).toHaveBeenCalledWith(['rate-row'], 'branch');
  });

  it('fails closed while any non-hotel producer is unavailable', async () => {
    const adapter = new VersionedPackagePricingSourceAdapter({} as never);
    await expect(
      adapter.resolve(
        [
          {
            owner: 'TICKET_CATALOG',
            kind: 'TICKET_RATE',
            id: 'ticket',
            version: 1,
          },
        ],
        'branch',
        'EUR',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SOURCE_RATE_UNAVAILABLE' }),
    });
  });
});
