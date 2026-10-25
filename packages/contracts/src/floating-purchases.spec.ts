import { describe, it, expect } from 'vitest';
import {
  isFloatingContract,
  canWriteOwnFloatingPurchase,
  FLOATING_PURCHASE_OWN,
  FLOATING_PURCHASE_ALL,
} from './floating-purchases';
import { canViewRoute } from './iam/user-access';
import { completeManualAccessPrerequisites } from './iam/manual-access-prerequisites';
const empty = { serviceSelections: [], ticketSelections: [] };
describe('floating sourcing boundaries', () => {
  it('classifies a mixed contract hotel when one flight is contract-only, without inferring from the hotel', () => {
    expect(
      isFloatingContract(
        { ...empty, ticketSelections: [{ source: 'CONTRACT_ONLY' }] } as never,
        false,
      ),
    ).toBe(true);
    expect(
      isFloatingContract({
        ...empty,
        serviceSelections: [
          { kind: 'HOTEL', metadata: { purchaseSupplyType: 'FLOATING' } },
        ],
      } as never),
    ).toBe(false);
    const spoof = {
      serviceSelections: [
        {
          kind: 'FLIGHT',
          clientKey: 'f',
          metadata: {
            purchaseSupplyType: 'FLOATING',
            contractFlightVersion: 1,
          },
        },
      ],
      ticketSelections: [{ serviceClientKey: 'f', source: 'CATALOG' }],
    };
    expect(isFloatingContract(spoof as never, false)).toBe(false);
    expect(isFloatingContract(spoof as never, true)).toBe(true);
  });
  it('separates own writes, manager read-all and branch/screen permissions', () => {
    expect(canWriteOwnFloatingPurchase([FLOATING_PURCHASE_OWN], 'a', 'a')).toBe(
      true,
    );
    expect(canWriteOwnFloatingPurchase([FLOATING_PURCHASE_OWN], 'a', 'b')).toBe(
      false,
    );
    expect(canWriteOwnFloatingPurchase([FLOATING_PURCHASE_ALL], 'a', 'a')).toBe(
      false,
    );
    expect(
      canWriteOwnFloatingPurchase([FLOATING_PURCHASE_OWN], 'a', null),
    ).toBe(false);
    expect(
      canViewRoute(
        [FLOATING_PURCHASE_OWN],
        '/ticket-purchases/floating-hotels',
      ),
    ).toBe(true);
    expect(
      canViewRoute(
        [FLOATING_PURCHASE_OWN],
        '/ticket-purchases/floating-flights',
      ),
    ).toBe(true);
    expect(canViewRoute([FLOATING_PURCHASE_OWN], '/ticket-purchases')).toBe(
      false,
    );
    expect(canViewRoute([FLOATING_PURCHASE_OWN], '/reservations')).toBe(false);
    expect(canViewRoute([], '/ticket-purchases/floating-hotels')).toBe(false);
    expect(
      canViewRoute(
        [FLOATING_PURCHASE_OWN, 'ui.deny.floating-purchases.hotels'],
        '/ticket-purchases/floating-hotels',
      ),
    ).toBe(false);
  });
  it('completes only the two selected floating screens, no generic Purchasing or Reservations grants', () => {
    const result = completeManualAccessPrerequisites({
      permissionCodes: [FLOATING_PURCHASE_OWN],
      screenIds: [],
      allowedControlIds: [],
    });
    expect(result.screenIds).toEqual([
      'floating-purchases.hotels',
      'floating-purchases.flights',
    ]);
    expect(result.allowedControlIds).toEqual(result.screenIds);
    expect(result.permissionCodes).toEqual([FLOATING_PURCHASE_OWN]);
  });
});
