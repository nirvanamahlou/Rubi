import { it, expect, vi } from 'vitest';
import { resolveFloatingContract } from './floating-purchase-policy';
it('uses authoritative inventory for catalogue and legacy floating flights, not client supply hints', async () => {
  const supply = vi.fn().mockResolvedValue('COMPANY');
  const snapshot = {
    serviceSelections: [
      {
        kind: 'FLIGHT',
        clientKey: 'f',
        referenceId: 'company',
        metadata: { purchaseSupplyType: 'FLOATING', contractFlightVersion: 1 },
      },
    ],
    ticketSelections: [
      { serviceClientKey: 'f', offerId: 'company', source: 'CATALOG' },
    ],
    selectedTicketOfferIds: ['company'],
  };
  expect(
    await resolveFloatingContract(snapshot as never, ['branch'], {
      documentSupply: supply,
    }),
  ).toBe(false);
  expect(supply).toHaveBeenCalledWith('company', ['branch']);
  supply.mockResolvedValue('FLOATING');
  expect(
    await resolveFloatingContract(
      { selectedTicketOfferIds: ['company'] } as never,
      ['branch'],
      { documentSupply: supply },
    ),
  ).toBe(true);
});
