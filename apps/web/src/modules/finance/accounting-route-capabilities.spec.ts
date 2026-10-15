import { describe, expect, it } from 'vitest';
import {
  accountingParityByRoute,
  accountingParityDefinitions,
} from './components/accounting-parity-definitions';
import { accountingRouteCapabilities } from './accounting-route-capabilities';
const capabilities = (route: string) =>
  accountingRouteCapabilities(accountingParityByRoute.get(route)!);
describe('accounting capability scopes', () => {
  it('records every source route without conflating storage and execution', () => {
    expect(
      accountingParityDefinitions.map(accountingRouteCapabilities),
    ).toHaveLength(91);
    expect(capabilities('taxpayer-system/settings')).toMatchObject({
      storage: true,
      execution: false,
      externalConnected: false,
      fullSourceParityVerified: false,
    });
    expect(
      capabilities('taxpayer-system/operations/batch-schedules'),
    ).toMatchObject({ storage: true, execution: false });
  });
  it('distinguishes internal reports, commands and source-blocked pages', () => {
    expect(capabilities('general-ledger/reports/matrix')).toMatchObject({
      reporting: true,
      execution: false,
      completeness: 'partial',
    });
    expect(capabilities('general-ledger/year-end/final')).toMatchObject({
      execution: true,
      storage: false,
    });
    expect(
      capabilities('general-ledger/reports/main-subledger-comparison'),
    ).toMatchObject({
      storage: false,
      execution: false,
      reporting: false,
      completeness: 'source-blocked',
    });
  });
});
