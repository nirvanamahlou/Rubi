import { describe, expect, it } from 'vitest';

import { PERMISSIONS_KEY } from '../iam/iam.constants';
import {
  CurrencyRateController,
  MasterDataAuditController,
} from './currency-rate.controller';

describe('MASTER-003 controller permission metadata', () => {
  it('requires both currency creation permissions for a quote', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CurrencyRateController.prototype.createQuote,
      ),
    ).toEqual(['master_data.create', 'master_data.currency_rate.create']);
  });
  it.each([
    [CurrencyRateController, 'history', 'master_data.read'],
    [CurrencyRateController, 'current', 'master_data.read'],
    [CurrencyRateController, 'approve', 'master_data.currency_rate.approve'],
    [CurrencyRateController, 'reject', 'master_data.currency_rate.approve'],
    [MasterDataAuditController, 'history', 'master_data.audit.read'],
  ] as const)('protects %s.%s with %s', (controller, method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        (controller.prototype as unknown as Record<string, object>)[method]!,
      ),
    ).toEqual([permission]);
  });
});
