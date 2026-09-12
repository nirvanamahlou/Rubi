import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateServicePurchase } from './reservation-service-purchase.service';

const valid = {
  version: 1 as const,
  expectedVersion: 0,
  serviceClientKey: 'hotel-1',
  supplierOrganizationId: '11111111-1111-4111-8111-111111111111',
  amount: '1250000',
  currencyCode: 'IRR',
};

describe('service purchase validation', () => {
  it('accepts a positive service purchase with broker and currency', () => {
    expect(() => validateServicePurchase(valid)).not.toThrow();
  });

  it('rejects zero amounts and malformed currencies', () => {
    expect(() => validateServicePurchase({ ...valid, amount: '0' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateServicePurchase({ ...valid, currencyCode: 'irr' }),
    ).toThrow(BadRequestException);
  });
});
