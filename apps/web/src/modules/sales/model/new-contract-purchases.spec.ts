import { expect, it, vi } from 'vitest';
import {
  purchaseDraftContext,
  purchaseDraftFingerprint,
  submitStagedPurchases,
  type StagedPurchase,
} from './new-contract-purchases';
import type { SalesContractCreateRequest } from '@nora/contracts';
const input = {
  customerId: 'customer',
  services: [
    {
      clientKey: 'flight-outbound',
      kind: 'FLIGHT',
      titleSnapshot: 'Flight',
      metadata: { contractFlightVersion: 1 },
    },
  ],
  passengers: [
    {
      customerId: 'passenger',
      ageCategory: 'ADT',
      serviceClientKeys: ['flight-outbound'],
    },
  ],
  ticketSelections: [],
  priceComponents: [
    { type: 'BASE', title: 'Sale', amount: '10', currencyCode: 'USD' },
  ],
} as unknown as SalesContractCreateRequest;
const purchase: StagedPurchase = {
  path: 'service-purchases',
  body: {
    version: 1,
    expectedVersion: 0,
    serviceClientKey: 'flight-outbound',
    supplierOrganizationId: 'supplier',
    amount: '9',
    currencyCode: 'USD',
  },
};
it('builds only selected services and passengers without putting costs in the sales payload', () => {
  const before = JSON.stringify(input);
  const request = purchaseDraftContext(input);
  expect(request.snapshot.serviceSelections).toEqual(input.services);
  expect(request.snapshot.passengerIds).toEqual(['passenger']);
  expect(JSON.stringify(input)).toBe(before);
  expect(purchaseDraftFingerprint({ ...input, priceComponents: [] })).toBe(
    purchaseDraftFingerprint(input),
  );
  expect(purchaseDraftFingerprint({ ...input, services: [] })).not.toBe(
    purchaseDraftFingerprint(input),
  );
});
it('records each obligation with the latest CAS version and supplier form version', async () => {
  const pending: Record<string, StagedPurchase> = {
    a: purchase,
    b: {
      path: 'purchase-batches',
      body: {
        version: 1,
        expectedVersion: 0,
        hotelStayKey: 'hotel',
        supplierFormVersion: 0,
        purchases: [],
      },
    },
  };
  const post = vi.fn().mockResolvedValue(undefined);
  const context = vi
    .fn()
    .mockResolvedValueOnce({ purchaseVersion: 2 })
    .mockResolvedValueOnce({ purchaseVersion: 3, workflow: { version: 4 } });
  await submitStagedPurchases(pending, {}, context, post, () => 'key');
  expect(post.mock.calls[0]![0].body.expectedVersion).toBe(2);
  expect(post.mock.calls[1]![0].body).toMatchObject({
    expectedVersion: 3,
    supplierFormVersion: 4,
  });
  expect(pending).toEqual({});
});
it('retries a lost response with identical body and key without recreating successful obligations', async () => {
  const pending: Record<string, StagedPurchase> = { a: purchase, b: purchase };
  const attempts = {};
  const context = vi.fn().mockResolvedValue({ purchaseVersion: 1 });
  const post = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(Error('lost'));
  await expect(
    submitStagedPurchases(pending, attempts, context, post, () => 'stable'),
  ).rejects.toThrow('lost');
  const sent = post.mock.calls[1];
  expect(Object.keys(pending)).toEqual(['b']);
  post.mockResolvedValue(undefined);
  context.mockResolvedValue({ purchaseVersion: 99 });
  await submitStagedPurchases(
    pending,
    attempts,
    context,
    post,
    () => 'different',
  );
  expect(post.mock.calls[2]).toEqual(sent);
  expect(context).toHaveBeenCalledTimes(2);
});
