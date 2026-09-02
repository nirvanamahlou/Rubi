import { describe, expect, it } from 'vitest';

import {
  MarketingDomainError,
  toMarketingErrorContract,
} from './marketing.errors';

describe('marketing local error contract', () => {
  it('maps conflicts to a retryable redacted envelope', () => {
    expect(
      toMarketingErrorContract(
        new MarketingDomainError('MARKETING_CONFLICT', 'Version mismatch.', {
          expectedVersion: 2,
        }),
      ),
    ).toEqual({
      error: {
        code: 'MARKETING_CONFLICT',
        message: 'Version mismatch.',
        details: { expectedVersion: 2 },
      },
      meta: { module: 'marketing', retryable: true },
    });
  });
});
