import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { FailClosedPackagePricingSourceAdapter } from './package-pricing-source.port';

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
